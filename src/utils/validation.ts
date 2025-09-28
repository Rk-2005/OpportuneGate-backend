import Joi from 'joi';

// Auth validation schemas
export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('STUDENT', 'ADMIN', 'COMPANY').required(),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  phone: Joi.string().pattern(/^[0-9]{10}$/).optional(),
  collegeCode: Joi.string().when('role', {
    is: 'STUDENT',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  rollNo: Joi.string().when('role', {
    is: 'STUDENT',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  branch: Joi.string().when('role', {
    is: 'STUDENT',
    then: Joi.required(),
    otherwise: Joi.optional()
  })
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Profile validation schemas
export const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).optional(),
  lastName: Joi.string().min(2).max(50).optional(),
  phone: Joi.string().pattern(/^[0-9]{10}$/).optional(),
  sscPercent: Joi.number().min(0).max(100).optional(),
  hscPercent: Joi.number().min(0).max(100).optional(),
  cgpa: Joi.number().min(0).max(10).optional(),
  currentYear: Joi.number().min(1).max(4).optional(),
  resume: Joi.string().optional(),
  documents: Joi.array().items(Joi.string()).optional()
});

// College validation schema
export const collegeSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  code: Joi.string().min(2).max(20).required(),
  address: Joi.string().min(5).max(200).required(),
  city: Joi.string().min(2).max(50).required(),
  state: Joi.string().min(2).max(50).required(),
  pincode: Joi.string().pattern(/^[0-9]{6}$/).required(),
  website: Joi.string().uri().optional()
});

// Company validation schema
export const companySchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  website: Joi.string().uri().optional(),
  industry: Joi.string().optional(),
  size: Joi.string().optional(),
  description: Joi.string().max(500).optional()
});

// Opportunity validation schema
export const opportunitySchema = Joi.object({
  title: Joi.string().min(5).max(100).required(),
  description: Joi.string().min(10).max(1000).required(),
  type: Joi.string().valid('INTERNSHIP', 'FULL_TIME', 'CONTEST', 'HACKATHON').required(),
  eligibility: Joi.object().required(),
  requirements: Joi.array().items(Joi.string()).required(),
  benefits: Joi.array().items(Joi.string()).required(),
  location: Joi.string().min(2).max(100).required(),
  salary: Joi.string().optional(),
  duration: Joi.string().optional(),
  applicationDeadline: Joi.date().greater('now').required(),
  groupId: Joi.string().allow('').optional(),
  rounds: Joi.array().items(Joi.object({
    id: Joi.number().required(),
    name: Joi.string().required(),
    description: Joi.string().required(),
    order: Joi.number().required()
  })).optional()
});

// Application validation schema
export const applicationSchema = Joi.object({
  opportunityId: Joi.string().required()
});

// Notification validation schema
export const notificationSchema = Joi.object({
  title: Joi.string().min(5).max(100).required(),
  message: Joi.string().min(10).max(500).required(),
  type: Joi.string().valid('opportunity', 'interview', 'status_update', 'general').required(),
  opportunityId: Joi.string().optional()
});
