"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOpportunityNotification = exports.sendWelcomeEmail = exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const transporter = nodemailer_1.default.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
const sendEmail = async (to, subject, html) => {
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
    }
    catch (error) {
        console.error('Email sending failed:', error);
        throw error;
    }
};
exports.sendEmail = sendEmail;
const sendWelcomeEmail = async (email, name, role) => {
    const subject = `Welcome to OpportuneGate - ${role} Registration Successful`;
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Welcome to OpportuneGate!</h2>
      <p>Dear ${name},</p>
      <p>Your ${role.toLowerCase()} account has been successfully created. You can now access the platform and start exploring opportunities.</p>
      <p>Best regards,<br>The OpportuneGate Team</p>
    </div>
  `;
    return (0, exports.sendEmail)(email, subject, html);
};
exports.sendWelcomeEmail = sendWelcomeEmail;
const sendOpportunityNotification = async (email, studentName, opportunityTitle) => {
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
    return (0, exports.sendEmail)(email, subject, html);
};
exports.sendOpportunityNotification = sendOpportunityNotification;
//# sourceMappingURL=email.js.map