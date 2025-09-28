import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      html
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent:', result.messageId);
    return result;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
};

export const sendWelcomeEmail = async (email: string, name: string, role: string) => {
  const subject = `Welcome to OpportuneGate - ${role} Registration Successful`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Welcome to OpportuneGate!</h2>
      <p>Dear ${name},</p>
      <p>Your ${role.toLowerCase()} account has been successfully created. You can now access the platform and start exploring opportunities.</p>
      <p>Best regards,<br>The OpportuneGate Team</p>
    </div>
  `;
  
  return sendEmail(email, subject, html);
};

export const sendOpportunityNotification = async (email: string, studentName: string, opportunityTitle: string) => {
  const subject = `New Opportunity: ${opportunityTitle}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">New Opportunity Available!</h2>
      <p>Dear ${studentName},</p>
      <p>A new opportunity "${opportunityTitle}" has been posted that matches your profile. Don't miss out!</p>
      <p>Login to your dashboard to apply.</p>
      <p>Best regards,<br>The OpportuneGate Team</p>
    </div>
  `;
  
  return sendEmail(email, subject, html);
};
