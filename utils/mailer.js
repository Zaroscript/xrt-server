import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendVerificationEmail = async (email, token) => {
  const url = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  await transporter.sendMail({
    to: email,
    subject: 'Verify Your XRT Tech Account',
    html: `<p>Click <a href="${url}">here</a> to verify your email.</p>`,
  });
};

const sendPasswordResetEmail = async (email, token) => {
  const url = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  await transporter.sendMail({
    to: email,
    subject: 'Reset Your Password',
    html: `<p>Click <a href="${url}">here</a> to reset your password. Link expires in 1 hour.</p>`,
  });
};

const sendTestEmail = async () => {
  await transporter.sendMail({
    to: process.env.EMAIL_USER,
    subject: 'Nodemailer Test',
    text: 'If you see this, email is working!',
  });
  console.log('Test email sent!');
};

export { sendVerificationEmail, sendPasswordResetEmail, sendTestEmail };