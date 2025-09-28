"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationSchema = exports.applicationSchema = exports.opportunitySchema = exports.companySchema = exports.collegeSchema = exports.updateProfileSchema = exports.loginSchema = exports.registerSchema = void 0;
const joi_1 = __importDefault(require("joi"));
// Auth validation schemas
exports.registerSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().min(6).required(),
    role: joi_1.default.string().valid('STUDENT', 'ADMIN', 'COMPANY').required(),
    firstName: joi_1.default.string().min(2).max(50).required(),
    lastName: joi_1.default.string().min(2).max(50).required(),
    phone: joi_1.default.string().pattern(/^[0-9]{10}$/).optional(),
    collegeCode: joi_1.default.string().when('role', {
        is: 'STUDENT',
        then: joi_1.default.required(),
        otherwise: joi_1.default.optional()
    }),
    rollNo: joi_1.default.string().when('role', {
        is: 'STUDENT',
        then: joi_1.default.required(),
        otherwise: joi_1.default.optional()
    }),
    branch: joi_1.default.string().when('role', {
        is: 'STUDENT',
        then: joi_1.default.required(),
        otherwise: joi_1.default.optional()
    })
});
exports.loginSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().required()
});
// Profile validation schemas
exports.updateProfileSchema = joi_1.default.object({
    firstName: joi_1.default.string().min(2).max(50).optional(),
    lastName: joi_1.default.string().min(2).max(50).optional(),
    phone: joi_1.default.string().pattern(/^[0-9]{10}$/).optional(),
    sscPercent: joi_1.default.number().min(0).max(100).optional(),
    hscPercent: joi_1.default.number().min(0).max(100).optional(),
    cgpa: joi_1.default.number().min(0).max(10).optional(),
    currentYear: joi_1.default.number().min(1).max(4).optional(),
    resume: joi_1.default.string().optional(),
    documents: joi_1.default.array().items(joi_1.default.string()).optional()
});
// College validation schema
exports.collegeSchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(100).required(),
    code: joi_1.default.string().min(2).max(20).required(),
    address: joi_1.default.string().min(5).max(200).required(),
    city: joi_1.default.string().min(2).max(50).required(),
    state: joi_1.default.string().min(2).max(50).required(),
    pincode: joi_1.default.string().pattern(/^[0-9]{6}$/).required(),
    website: joi_1.default.string().uri().optional()
});
// Company validation schema
exports.companySchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(100).required(),
    website: joi_1.default.string().uri().optional(),
    industry: joi_1.default.string().optional(),
    size: joi_1.default.string().optional(),
    description: joi_1.default.string().max(500).optional()
});
// Opportunity validation schema
exports.opportunitySchema = joi_1.default.object({
    title: joi_1.default.string().min(5).max(100).required(),
    description: joi_1.default.string().min(10).max(1000).required(),
    type: joi_1.default.string().valid('INTERNSHIP', 'FULL_TIME', 'CONTEST', 'HACKATHON').required(),
    eligibility: joi_1.default.object().required(),
    requirements: joi_1.default.array().items(joi_1.default.string()).required(),
    benefits: joi_1.default.array().items(joi_1.default.string()).required(),
    location: joi_1.default.string().min(2).max(100).required(),
    salary: joi_1.default.string().optional(),
    duration: joi_1.default.string().optional(),
    applicationDeadline: joi_1.default.date().greater('now').required(),
    groupId: joi_1.default.string().allow('').optional(),
    rounds: joi_1.default.array().items(joi_1.default.object({
        id: joi_1.default.number().required(),
        name: joi_1.default.string().required(),
        description: joi_1.default.string().required(),
        order: joi_1.default.number().required()
    })).optional()
});
// Application validation schema
exports.applicationSchema = joi_1.default.object({
    opportunityId: joi_1.default.string().required()
});
// Notification validation schema
exports.notificationSchema = joi_1.default.object({
    title: joi_1.default.string().min(5).max(100).required(),
    message: joi_1.default.string().min(10).max(500).required(),
    type: joi_1.default.string().valid('opportunity', 'interview', 'status_update', 'general').required(),
    opportunityId: joi_1.default.string().optional()
});
//# sourceMappingURL=validation.js.map