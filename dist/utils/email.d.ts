export declare const sendEmail: (to: string, subject: string, html: string) => Promise<import("nodemailer/lib/smtp-transport").SentMessageInfo>;
export declare const sendWelcomeEmail: (email: string, name: string, role: string) => Promise<import("nodemailer/lib/smtp-transport").SentMessageInfo>;
export declare const sendOpportunityNotification: (email: string, studentName: string, opportunityTitle: string) => Promise<import("nodemailer/lib/smtp-transport").SentMessageInfo>;
//# sourceMappingURL=email.d.ts.map