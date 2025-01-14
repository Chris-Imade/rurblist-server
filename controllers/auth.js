const { genPassword, validatePass } = require("../lib/passwordUtils");
const User = require("../schemas/User");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

require("dotenv").config();

// Create a Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail", // Replace with your email service
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USERNAME, // Your email username
    pass: process.env.EMAIL_PASSWORD, // Your email password
  },
});

const sendWelcomeEmail = async (email, name) => {
  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to: email,
    subject: "Welcome to Our Service",
    text: `Hello, ${name}. Welcome to our platform!`,
    html: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to Rurblist - Your Access To Dream Home!</title>
  </head>
  <body
    style="
      font-family: Arial, sans-serif;
      background-color: #f9f9f9;
      padding: 20px;
      color: #333;
    "
  >
    <table
      width="100%"
      cellpadding="0"
      cellspacing="0"
      style="
        max-width: 600px;
        margin: auto;
        background-color: #ffffff;
        border-radius: 8px;
        overflow: hidden;
      "
    >
      <tr>
        <td
          style="
            padding: 20px;
            text-align: center;
            background-color: #ec6c10;
            color: #ffffff;
          "
        >
          <h1 style="margin: 0">Rurblist</h1>
          <p style="margin: 0">Your Access To Dream Home!</p>
        </td>
      </tr>
      <tr>
        <td style="padding: 20px">
          <p>Dear <strong>[Username/Foundation Name]</strong>,</p>

          <p>
            Congratulations on joining Rurblist, your premier marketplace for
            homes and properties!
          </p>

          <p>
            We're thrilled to have you on board! At Rurblist, our mission is to
            make finding your dream home or investment property seamless and
            enjoyable.
          </p>

          <h3>To get started:</h3>
          <ul style="padding-left: 20px; margin: 10px 0">
            <li>
              Browse our extensive listings: Explore thousands of properties,
              filtered by location, price, and amenities.
            </li>
            <li>
              Save your favorite listings: Create a personalized portfolio for
              easy reference.
            </li>
            <li>
              Connect with verified sellers/agents: Get expert guidance and
              negotiate the best deals.
            </li>
          </ul>

          <p style="text-align: center; margin: 20px 0">
            <a
              href="[Insert Link to Start Exploring Properties]"
              style="
                background-color: #ec6c10;
                color: #ffffff;
                padding: 10px 20px;
                text-decoration: none;
                border-radius: 5px;
              "
              >Start Exploring Properties</a
            >
          </p>

          <p>Need assistance? Our dedicated support team is here to help:</p>
          <p style="text-align: left; font-size: 14px; color: #333">
            <strong>Email:</strong>
            <a href="mailto:support@rurblist.com" style="color: #ec6c10"
              >support@rurblist.com</a
            ><br />
            <strong>Phone:</strong> 1-800-RURBLIST
          </p>

          <p>Thank you for choosing Rurblist!</p>

          <p>Best regards,</p>
          <p>Support team<br />Rurblist</p>

          <hr
            style="border: none; border-top: 1px solid #ddd; margin: 20px 0"
          />

          <p style="text-align: center; font-size: 14px; color: #555">
            P.S. Follow us on social media for exclusive updates, market
            insights, and property tips!
          </p>

          <p style="text-align: center">
            <a
              href="[Insert Facebook Link]"
              style="color: #ec6c10; text-decoration: none"
              >Facebook</a
            >
            |
            <a
              href="[Insert Twitter Link]"
              style="color: #ec6c10; text-decoration: none"
              >Twitter</a
            >
            |
            <a
              href="[Insert Instagram Link]"
              style="color: #ec6c10; text-decoration: none"
              >Instagram</a
            >
          </p>
        </td>
      </tr>
      <tr>
        <td
          style="
            padding: 10px;
            text-align: center;
            background-color: #f1f1f1;
            color: #777;
            font-size: 12px;
          "
        >
          &copy; 2024 Rurblist. All rights reserved.
        </td>
      </tr>
    </table>
  </body>
</html>
`, // Ensure this file path is correct
  };

  return transporter.sendMail(mailOptions);
};

const registerUser = async (req, res, next) => {
  const { password, email, name, ...otherDetails } = req.body;

  try {
    // Generate salt and hash for the password
    const { salt, hash } = genPassword(password);

    // Create user credentials
    const userCred = { salt, hash, email, name, ...otherDetails };

    // Create a new user instance
    const userInstance = new User(userCred);

    // Save the user to the database
    await userInstance.save();

    // Send a welcome email
    await sendWelcomeEmail(email, name);

    // Respond with success
    res.status(201).json({
      message: "User successfully created",
      status: 201,
    });
  } catch (error) {
    // Pass errors to the error-handling middleware
    next(error);
  }
};

const loginUser = (req, res, next) => {
  const { username, password } = req.body;

  User.findOne({ username })
    .then((user) => {
      // compare passwords match
      const isValid = validatePass(password, user.hash, user.salt);

      if (isValid) {
        const token = jwt.sign(
          { id: user._id, isAdmin: user.isAdmin, email: user.email },
          process.env.JWT_SECRET
        );
        res.status(200).json({
          message: "Success",
          status: 200,
          details: "User successfully logged in 😇",
          token,
        });
      }

      if (!isValid) {
        // return an error
        res.status(401).json({
          message: "Failed",
          status: 401,
          details: "Invalid Credentials",
        });
      }
    })
    .catch((err) => {
      next(err);
    });
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Check if the email exists in the database
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        message: "Email not found",
        status: 404,
        detail: "User with this email not found, use a valid mail",
      });
    }

    // Generate a password reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Set token expiration to 1 hour from now
    const tokenExpiration = Date.now() + 3600000; // 1 hour in milliseconds

    // Store the token and expiration date in the database
    user.resetToken = resetToken;
    user.tokenExpiration = new Date(tokenExpiration);
    await user.save();

    // Create the reset URL (make sure to replace 'yourwebsite.com' with your actual domain)
    const resetUrl = `http://yourwebsite.com/reset-password/${resetToken}`;

    // Create email options
    const mailOptions = {
      from: process.env.EMAIL_USERNAME, // Sender address
      to: email,
      subject: "Password Reset Request",
      text: `Hello, ${user.name}. Click the link below to reset your password:\n\n${resetUrl}`,
      html: `
        <p>Hello, ${user.name}.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
      `,
    };

    // Send the email
    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: "Password reset email sent",
      status: 200,
      detail: "Password reset link has been sent to your mail",
    });
  } catch (error) {
    console.error("Error sending email:", error);
    next(error); // Pass the error to the error handler middleware
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params; // Token from URL
    const { newPassword } = req.body; // New password from user input

    // Find the user with the provided reset token and check if it's not expired
    const user = await User.findOne({
      resetToken: token,
      tokenExpiration: { $gt: Date.now() }, // Check if the token is not expired
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired token",
        status: 400,
        detail:
          "The password reset link is either invalid or has expired. Please request a new one.",
      });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10); // Salt rounds set to 10

    // Update the user's password and clear the reset token and expiration
    user.password = hashedPassword;
    user.resetToken = undefined; // Clear the reset token
    user.tokenExpiration = undefined; // Clear the expiration time
    await user.save(); // Save the updated user document

    res.status(200).json({
      message: "Password successfully reset",
      status: 200,
      detail:
        "Your password has been reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    next(error); // Pass error to error handling middleware
  }
};

module.exports = {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
};