// // Login Form //


// // Registration Form //
// const registrationForm = document.querySelector("#registrationForm");

// registrationForm.addEventListener("submit", function (event) {
//   const password = document.querySelector("#password");
//   const confirmPassword = document.querySelector("#confirmPassword");

//   if (password.value !== confirmPassword.value) {
//     event.preventDefault(); 
//     alert("Error: Passwords do not match.");

//     password.value = "";
//     confirmPassword.value = "";

//     password.focus();
//   }
// });

//Show Password//

function showPassword(selecter, img) {
  const toggle = document.querySelector(selecter);
  if (toggle.type === 'password') {
    toggle.classList.remove('closedEye');
    toggle.classList.add('openEye');
    toggle.type = 'text';
    img.src = "/properties/openEye.jpg";
  } else {
    toggle.classList.remove('openEye');
    toggle.classList.add('closedEye');
    toggle.type = 'password';
    img.src = "/properties/closedEye.jpg";
  }
  
}