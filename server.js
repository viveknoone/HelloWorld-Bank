const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcryptjs");
const { type } = require("os");
const session = require("express-session");
const nodemailer = require("nodemailer");

const app = express();

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));

// Serve all static files (HTML, CSS, images)
app.use(express.static(__dirname));

app.use(
  session({
    secret: "helloworldbank-secret", // 🧠 use env in real apps
    resave: false,
    saveUninitialized: true,
  })
);

// MongoDB connection
mongoose
  .connect("mongodb://localhost:27017/userDB")
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Schema and Model
const userSchema = new mongoose.Schema({
  fullname: String,
  aadhar: String,
  phone: String,
  email: String,
  dob: String,
  gender: String,
  username: String,
  password: String,
  terms: Boolean,
  accountNumber: {
    type: String,
    unique: true,
    required: true,
  },
  balance: {
    type: Number,
    default: 20000,
  },
});

const User = mongoose.model("User", userSchema);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "Home.html"));
});

// Serve registration page
app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "RegistrationForm.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "LoginForm.html"));
});

app.get("/logged", (req, res) => {
  res.sendFile(path.join(__dirname, "LoggedIn.html"));
});

app.get("/transfer", (req, res) => {
  res.sendFile(path.join(__dirname, "MoneyTransfer.html"));
});
app.get("/show-balance", (req, res) => {
  res.sendFile(path.join(__dirname, "CheckBalance.html"));
});
app.get("/transactions", (req, res) => {
  res.sendFile(path.join(__dirname, "Transactions.html"));
});
app.get("/forgotPassword", (req, res) => {
  res.sendFile(path.join(__dirname, "ForgotPassword.html"));
});
app.get("/resetPassword", (req, res) => {
  res.sendFile(path.join(__dirname, "ResetPassword.html"));
});

app.get("/current-user", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.json({
    username: req.session.user.username,
    accountNumber: req.session.user.accountNumber
  });
});

// Handle form submission and save to DB
app.post("/register", async (req, res) => {
  try {
    const {
      fullname,
      aadhar,
      phone,
      email,
      dob,
      gender,
      username,
      password,
      confirmPassword,
      terms,
    } = req.body;

    // ✅ Match passwords
    if (password !== confirmPassword) {
      return res.send("❌ Passwords do not match");
    }

    // ✅ OPTIONAL: Check if username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.send("❌ Username already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    function generateAccountNumber() {
      return Math.floor(1000000000 + Math.random() * 9000000000);
    }

    let accountNumber;
    let exists = true;

    while (exists) {
      accountNumber = generateAccountNumber();
      const existingNumber = await User.findOne({ accountNumber });
      if (!existingNumber) exists = false;
    }

    const newUser = new User({
      fullname,
      aadhar,
      phone,
      email,
      dob,
      gender,
      username,
      password: hashedPassword,
      terms: terms === "on",
      accountNumber,
    });

    await newUser.save();
    req.session.user = newUser;

    res.redirect("/logged");
  } catch (err) {
    res.status(500).send("Something went wrong while saving user");
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });

    if (!user) {
      return res.send("❌ User not found");
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.send("❌ Incorrect password");
    }
  
    req.session.user = user;
    res.redirect("/logged");
  } catch (err) {
    res.status(500).send("Server error");
  }
});

app.post("/transfer", async (req, res) => {
  const { accountNumber, amount, password } = req.body;

  try {
    const account = await User.findOne({ accountNumber });
    const user = req.session.user;

    if (!user) {
      return res.status(401).send("Unauthorized: Please login first");
    }

    if (!account) {
      return res.send("❌ User not found");
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.send("❌ Incorrect password");
    }

    const balance = user.balance;

    if (balance < amount) {
      return res.send("❌ Insufficient Funds");
    }
    await User.updateOne(
      { username: user.username },
      { $set: { balance: balance - amount } }
    );

    await User.updateOne(
      { accountNumber: accountNumber },
      { $inc: { balance: amount } }
    );

    await Transaction.create({
      from: user.accountNumber,
      to: account.accountNumber,
      amount: Number(amount),
    });
    const updatedUser = await User.findOne({ username: user.username });
    req.session.user = updatedUser;

    res.send("✅ Money sent successfully");
  } catch (err) {
    res.status(500).send("❌ Something went wrong");
  }
});

app.get("/check-balance", async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).send("Unauthorized: Please login first");
    }

    res.send(`
    <h1> Hello! ${user.username}
    <h2> Your current balance is: ₹${user.balance}<h2>
    <a href="/Logged">Go Back</a>
    `);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

const transactionSchema = new mongoose.Schema({
  from: String,
  to: String,
  amount: Number,
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const Transaction = mongoose.model("Transaction", transactionSchema);

app.get("/transactions-data", async (req, res) => {
  try {
    const user = req.session.user;

    if (!user) {
      return res.status(401).send("Unauthorized: Please login");
    }
    const transactions = await Transaction.aggregate([
      {
        $match: {
          $or: [{ from: user.accountNumber }, { to: user.accountNumber }],
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "from",
          foreignField: "accountNumber",
          as: "fromUser",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "to",
          foreignField: "accountNumber",
          as: "toUser",
        },
      },
      {
        $project: {
          from: { $arrayElemAt: ["$fromUser.username", 0] },
          to: { $arrayElemAt: ["$toUser.username", 0] },
          amount: 1,
          timestamp: 1,
        },
      },
      { $sort: { timestamp: -1 } },
    ]);

    res.json(transactions);
  } catch (err) {
    res.status(500).send("Error loading transactions");
  }
});

function generateOtp() {
  const otp = Math.floor(100000 + Math.random() * 900000);

  return String(otp);
}

async function sendOtpEmail(recipientEmail, generatedOTP) {

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "helloworldbankservices@gmail.com",
      pass: "pvcc itax ermb iksn",
    },
  });

  const mailOptions = {
    from: '"HelloWorld Bank" <helloworld.services@gmail.com>',
    to: recipientEmail,
    subject: "Your One-Time Password (OTP) Verification Code",
    text: `Your 6-digit verification code is: ${generatedOTP}. Please use this code to complete your action.`,
    html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #333;">OTP Verification</h2>
                <p>Hello,</p>
                <p>Thank you for using our service. Please use the following One-Time Password (OTP) to complete your verification:</p>
                <h1 style="color: #007bff; text-align: center; background-color: #f0f0f0; padding: 10px; border-radius: 5px; letter-spacing: 5px;">
                    ${generatedOTP}
                </h1>
                <p style="font-size: 0.9em; color: #777;">This code is typically valid for a limited time (e.g., 5-10 minutes).</p>
            </div>
        `,
  };

  try {
    let info = await transporter.sendMail(mailOptions);
    console.log(`Email successfully sent to ${recipientEmail}`);
    console.log("Message ID:", info.messageId);
    return { success: true, otp: generatedOTP };
  } catch (error) {
    console.error("Error sending email:", error.message);
    return { success: false, error: error.message };
  }
}
app.post("/forgotPassword", async (req, res) => {
  const recipientEmail = req.body.email;
  if (!recipientEmail) {
    return res.send("❌ Email is required in the request body.");
  }

  try {
    const user = await User.findOne({ email: recipientEmail });

    if (!user) {
      return res.send(
        "❌ No user found with that email, please check your email address."
      );
    }
    const generatedOTP = generateOtp();
    console.log(`Generated OTP: ${generatedOTP}`);

    req.session.otp = {
            code: generatedOTP,
            email: recipientEmail,
            expires: Date.now() + 300000
        };

    const emailResult = await sendOtpEmail(recipientEmail, generatedOTP);

    if (emailResult.success) {
      req.session.userEmail = recipientEmail;

      return res.send("✅ OTP sent successfully! Check your inbox.");

    } else {
      delete req.session.otp;
      return res.send("❌ Failed to send OTP email.");
    }

  } catch (err) {
    return res.send("Server error");
  }
});

app.post("/verifyOtp", (req, res) => {
  const { otp } = req.body;

  if (!otp) {
    return res.send("❌ Please enter the OTP.");
  }

  const sessionOtp = req.session.otp;

  if (!sessionOtp) {
    return res.send("❌ OTP expired or not requested. Please request a new OTP.");
  }

  if (Date.now() > sessionOtp.expires) {
    delete req.session.otp;
    return res.send("❌ OTP expired. Please request a new OTP.");
  }

  if (otp !== sessionOtp.code) {
    return res.send("❌ Incorrect OTP. Please try again.");
  }

  req.session.isOtpVerified = true;

  req.session.resetEmail = sessionOtp.email;

  delete req.session.otp;

  return res.redirect("/resetPassword"); 
});



app.post("/resetPassword", async (req, res) => {
  const { newPassword } = req.body;

  if (!req.session.isOtpVerified || !req.session.resetEmail) {
    return res.send("❌ Unauthorized access!");
  }

  const hashed = await bcrypt.hash(newPassword, 10);

  try {
    await User.findOneAndUpdate(
      { email: req.session.resetEmail },
      { password: hashed }
    );

    // Clean session
    delete req.session.isOtpVerified;
    delete req.session.resetEmail;

    return res.send("✅ Password reset successfully!");
  } catch (err) {
    console.error(err);
    return res.send("❌ Server error while resetting password");
  }
});


// Start server
app.listen(3000, () => {
  console.log("🚀 Server started at http://localhost:3000/");
});
