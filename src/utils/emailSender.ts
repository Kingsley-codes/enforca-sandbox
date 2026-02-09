import nodemailer, { SentMessageInfo } from "nodemailer";

// Create transporter with Google SMTP
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS, // Use App Password if 2FA is enabled
  },
});

// Verify transporter connection
transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP connection error:", error);
  } else {
    console.log("SMTP server is ready to take messages");
  }
});

// export const sendVendorVerificationEmail = async (email, code, isResend = false) => {
//   const subject = isResend
//     ? 'New Verification Code To Your Meride Haven Vendor Account'
//     : "Verify To Your Meride Haven Vendor Account";

//   const mailOptions = {
//     from: `"Meride Haven" <${process.env.GMAIL_USER}>`,
//     to: email,
//     subject,
//     html: `
//       <!DOCTYPE html>
//       <html>
//       <head>
//         <meta charset="UTF-8">
//         <style>
//           body {
//             font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
//             line-height: 1.6;
//             color: #333;
//             max-width: 600px;
//             margin: 0 auto;
//             padding: 20px;
//             background-color: #fafafa;
//           }
//           .header {
//             text-align: center;
//             margin-bottom: 30px;
//           }
//           .logo {
//             color: #DAA520;
//             font-size: 24px;
//             font-weight: bold;
//             margin-bottom: 10px;
//           }
//           h2 {
//             color: #b8860b;
//             margin: 0;
//           }
//           .code-container {
//             background-color: #fff8e7;
//             border: 1px solid #DAA520;
//             border-radius: 8px;
//             padding: 20px;
//             text-align: center;
//             margin: 25px 0;
//           }
//           .verification-code {
//             font-size: 32px;
//             letter-spacing: 3px;
//             color: #DAA520;
//             font-weight: bold;
//           }
//           .button {
//             display: inline-block;
//             background-color: #DAA520;
//             color: white !important;
//             text-decoration: none;
//             padding: 12px 25px;
//             border-radius: 5px;
//             font-weight: bold;
//             margin: 20px 0;
//             transition: background-color 0.3s ease;
//           }
//           .button:hover {
//             background-color: #b8860b;
//           }
//           .footer {
//             margin-top: 30px;
//             font-size: 12px;
//             color: #777;
//             text-align: center;
//           }
//           a {
//             color: #DAA520;
//             text-decoration: none;
//           }
//           a:hover {
//             color: #b8860b;
//             text-decoration: underline;
//           }
//         </style>
//       </head>
//       <body>
//         <div class="header">
//           <div class="logo">Meride Haven</div>
//           <h2>Verify Your Email Address</h2>
//         </div>

//         <p>${isResend ? 'Here is a new verification code:' : 'Thank you for creating a vendor account with Meride Haven. To complete your registration, please use the following verification code:'} </p>

//         <div class="code-container">
//           <div class="verification-code">${code}</div>
//         </div>

//         <p>This code will expire in 2 minutes. If you didn't request this code, you can safely ignore this email.</p>

//         <p>Need help? <a href="mailto:support@meridehaven.com">Contact our support team</a></p>

//         <div class="footer">
//           <p>© ${new Date().getFullYear()} Meride Haven. All rights reserved.</p>
//           <p>If you're having trouble with the code above, you can also copy and paste it directly.</p>
//         </div>
//       </body>
//       </html>
//     `,
//     text: `
//       ${isResend ? 'New Verification Code for Your Meride Haven Vendor Account' : 'Verify Your Meride Haven Vendor Account'}

//       ${isResend ? 'Here is your new verification code:' : 'Thank you for creating a vendor account with Meride Haven.'}

//       Your verification code is: ${code}

//       This code will expire in 2 minutes. If you didn't request this code, you can safely ignore this email.

//       Need help? Contact our support team at support@meridehaven.com

//       © ${new Date().getFullYear()} Meride Haven. All rights reserved.
//     `,
//   };

//   try {
//     const result = await transporter.sendMail(mailOptions);
//     console.log(`Vendor verification email sent to ${email}`);
//     return result;
//   } catch (error) {
//     console.error("Error sending vendor verification email:", error);
//     throw new Error(`Failed to send verification email: ${error.message}`);
//   }
// };

export const sendUserVerificationEmail = async (
  email: string,
  code: string,
  isResend: boolean = false,
): Promise<SentMessageInfo> => {
  const subject = isResend
    ? "New Verification Code To Your Meride Haven Account"
    : "Verify To Your Meride Haven Account";

  const mailOptions: nodemailer.SendMailOptions = {
    from: `"Meride Haven" <${process.env.GMAIL_USER}>`,
    to: email,
    subject,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #fafafa;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            color: #DAA520;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          h2 {
            color: #b8860b;
            margin: 0;
          }
          .code-container {
            background-color: #fff8e7;
            border: 1px solid #DAA520;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 25px 0;
          }
          .verification-code {
            font-size: 32px;
            letter-spacing: 3px;
            color: #DAA520;
            font-weight: bold;
          }
          .button {
            display: inline-block;
            background-color: #DAA520;
            color: white !important;
            text-decoration: none;
            padding: 12px 25px;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
            transition: background-color 0.3s ease;
          }
          .button:hover {
            background-color: #b8860b;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #777;
            text-align: center;
          }
          a {
            color: #DAA520;
            text-decoration: none;
          }
          a:hover {
            color: #b8860b;
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">Meride Haven</div>
          <h2>Verify Your Email Address</h2>
        </div>

        <p>${isResend ? "Here is a new verification code:" : "Thank you for creating an account with Meride Haven. To complete your registration, please use the following verification code:"} </p>

        <div class="code-container">
          <div class="verification-code">${code}</div>
        </div>

        <p>This code will expire in 2 minutes. If you didn't request this code, you can safely ignore this email.</p>

        <p>Need help? <a href="mailto:support@meridehaven.com">Contact our support team</a></p>

        <div class="footer">
          <p>© ${new Date().getFullYear()} Meride Haven. All rights reserved.</p>
          <p>If you're having trouble with the code above, you can also copy and paste it directly.</p>
        </div>
      </body>
      </html>
    `,
    text: `
      ${isResend ? "New Verification Code for Your Meride Haven Account" : "Verify Your Meride Haven Account"}

      ${isResend ? "Here is your new verification code:" : "Thank you for creating an account with Meride Haven."}

      Your verification code is: ${code}

      This code will expire in 2 minutes. If you didn't request this code, you can safely ignore this email.

      Need help? Contact our support team at support@meridehaven.com

      © ${new Date().getFullYear()} Meride Haven. All rights reserved.
    `,
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log(`User verification email sent to ${email}`);
    return result;
  } catch (error: any) {
    console.error("Error sending user verification email:", error);
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
};

// export const sendVendorPasswordResetEmail = async (email, code) => {
//   const resetLink = `${process.env.FRONTEND_URL}/vendor/reset-verification?email=${encodeURIComponent(email)}&code=${code}`;

//   const mailOptions = {
//     from: `"Meride Haven" <${process.env.GMAIL_USER}>`,
//     to: email,
//     subject: "Password Reset Request for Meride Haven Vendor Account",
//     html: `
//       <!DOCTYPE html>
//       <html>
//       <head>
//         <meta charset="UTF-8">
//         <style>
//           body {
//             font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
//             line-height: 1.6;
//             color: #333;
//             max-width: 600px;
//             margin: 0 auto;
//             padding: 20px;
//             background-color: #fafafa;
//           }
//           .header {
//             text-align: center;
//             margin-bottom: 30px;
//           }
//           .logo {
//             color: #DAA520;
//             font-size: 24px;
//             font-weight: bold;
//             margin-bottom: 10px;
//           }
//           h2 {
//             color: #b8860b;
//             margin: 0;
//           }
//           .code-container {
//             background-color: #fff8e7;
//             border: 1px solid #DAA520;
//             border-radius: 8px;
//             padding: 20px;
//             text-align: center;
//             margin: 25px 0;
//           }
//           .verification-code {
//             font-size: 32px;
//             letter-spacing: 3px;
//             color: #DAA520;
//             font-weight: bold;
//           }
//           .button {
//             display: inline-block;
//             background-color: #DAA520;
//             color: white !important;
//             text-decoration: none;
//             padding: 12px 25px;
//             border-radius: 5px;
//             font-weight: bold;
//             margin: 20px 0;
//             transition: background-color 0.3s ease;
//           }
//           .button:hover {
//             background-color: #b8860b;
//           }
//           .footer {
//             margin-top: 30px;
//             font-size: 12px;
//             color: #777;
//             text-align: center;
//           }
//           a {
//             color: #DAA520;
//             text-decoration: none;
//           }
//           a:hover {
//             color: #b8860b;
//             text-decoration: underline;
//           }
//         </style>
//       </head>
//       <body>
//         <div class="header">
//           <div class="logo">Meride Haven</div>
//           <h2>Password Reset Request</h2>
//         </div>

//         <p>We received a request to reset your Meride Haven vendor account password. You can either:</p>

//         <p><strong>Use this verification code:</strong></p>
//         <div class="code-container">
//           <div class="verification-code">${code}</div>
//         </div>

//         <p><strong>Or click this button to reset your password:</strong></p>
//         <div style="text-align: center;">
//           <a href="${resetLink}" class="button">Reset Password</a>
//         </div>

//         <p>This link and code will expire in 2 minutes. If you didn't request this, please secure your account.</p>

//         <p>Need help? <a href="mailto:support@meridehaven.com">Contact our support team</a></p>

//         <div class="footer">
//           <p>© ${new Date().getFullYear()} Meride Haven. All rights reserved.</p>
//           <p>If the button doesn't work, copy and paste this link into your browser: ${resetLink}</p>
//         </div>
//       </body>
//       </html>
//     `,
//     text: `
//       Password Reset Request for Meride Haven Vendor Account

//       We received a request to reset your password.

//       Reset Link: ${resetLink}

//       Or use this code: ${code}

//       This link/code will expire in 2 minutes. If you didn't request this, please secure your account.

//       Need help? Contact our support team at support@meridehaven.com

//       © ${new Date().getFullYear()} Meride Haven. All rights reserved.
//     `,
//   };

//   try {
//     const result = await transporter.sendMail(mailOptions);
//     console.log(`Vendor password reset email sent to ${email}`);
//     return result;
//   } catch (error) {
//     console.error("Error sending vendor password reset email:", error);
//     throw new Error(`Failed to send password reset email: ${error.message}`);
//   }
// };

// export const sendUserPasswordResetEmail = async (email, code) => {
//   const resetLink = `${process.env.FRONTEND_URL}/user/authentication/reset-verification?email=${encodeURIComponent(email)}&code=${code}`;

//   const mailOptions = {
//     from: `"Meride Haven" <${process.env.GMAIL_USER}>`,
//     to: email,
//     subject: "Password Reset Request for Meride Haven Account",
//     html: `
//       <!DOCTYPE html>
//       <html>
//       <head>
//         <meta charset="UTF-8">
//         <style>
//           body {
//             font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
//             line-height: 1.6;
//             color: #333;
//             max-width: 600px;
//             margin: 0 auto;
//             padding: 20px;
//             background-color: #fafafa;
//           }
//           .header {
//             text-align: center;
//             margin-bottom: 30px;
//           }
//           .logo {
//             color: #DAA520;
//             font-size: 24px;
//             font-weight: bold;
//             margin-bottom: 10px;
//           }
//           h2 {
//             color: #b8860b;
//             margin: 0;
//           }
//           .code-container {
//             background-color: #fff8e7;
//             border: 1px solid #DAA520;
//             border-radius: 8px;
//             padding: 20px;
//             text-align: center;
//             margin: 25px 0;
//           }
//           .verification-code {
//             font-size: 32px;
//             letter-spacing: 3px;
//             color: #DAA520;
//             font-weight: bold;
//           }
//           .button {
//             display: inline-block;
//             background-color: #DAA520;
//             color: white !important;
//             text-decoration: none;
//             padding: 12px 25px;
//             border-radius: 5px;
//             font-weight: bold;
//             margin: 20px 0;
//             transition: background-color 0.3s ease;
//           }
//           .button:hover {
//             background-color: #b8860b;
//           }
//           .footer {
//             margin-top: 30px;
//             font-size: 12px;
//             color: #777;
//             text-align: center;
//           }
//           a {
//             color: #DAA520;
//             text-decoration: none;
//           }
//           a:hover {
//             color: #b8860b;
//             text-decoration: underline;
//           }
//         </style>
//       </head>
//       <body>
//         <div class="header">
//           <div class="logo">Meride Haven</div>
//           <h2>Password Reset Request</h2>
//         </div>

//         <p>We received a request to reset your Meride Haven account password. You can either:</p>

//         <p><strong>Use this verification code:</strong></p>
//         <div class="code-container">
//           <div class="verification-code">${code}</div>
//         </div>

//         <p><strong>Or click this button to reset your password:</strong></p>
//         <div style="text-align: center;">
//           <a href="${resetLink}" class="button">Reset Password</a>
//         </div>

//         <p>This link and code will expire in 2 minutes. If you didn't request this, please secure your account.</p>

//         <p>Need help? <a href="mailto:support@meridehaven.com">Contact our support team</a></p>

//         <div class="footer">
//           <p>© ${new Date().getFullYear()} Meride Haven. All rights reserved.</p>
//           <p>If the button doesn't work, copy and paste this link into your browser: ${resetLink}</p>
//         </div>
//       </body>
//       </html>
//     `,
//     text: `
//       Password Reset Request for Meride Haven Account

//       We received a request to reset your password.

//       Reset Link: ${resetLink}

//       Or use this code: ${code}

//       This link/code will expire in 2 minutes. If you didn't request this, please secure your account.

//       Need help? Contact our support team at support@meridehaven.com

//       © ${new Date().getFullYear()} Meride Haven. All rights reserved.
//     `,
//   };

//   try {
//     const result = await transporter.sendMail(mailOptions);
//     console.log(`User password reset email sent to ${email}`);
//     return result;
//   } catch (error) {
//     console.error("Error sending user password reset email:", error);
//     throw new Error(`Failed to send password reset email: ${error.message}`);
//   }
// };
