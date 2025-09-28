import express from 'express';
import bcrypt from 'bcryptjs';
import { generateToken } from '../utils/jwt';
import { sendWelcomeEmail } from '../utils/email';
import { authenticate, AuthRequest } from '../middleware/auth';
import { registerSchema, loginSchema } from '../utils/validation';
import { prisma } from '../lib/prisma';

type UserRole = 'STUDENT' | 'ADMIN' | 'COMPANY';

const router = express.Router();

// Register
router.post('/register', async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { email, password, role, firstName, lastName, phone, collegeCode, rollNo, branch } = value;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user and related records in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          role: role as UserRole
        }
      });

      // Create profile
      await tx.profile.create({
        data: {
          userId: user.id,
          firstName,
          lastName,
          phone
        }
      });

      // Handle role-specific data
      if (role === 'STUDENT' && collegeCode && rollNo && branch) {
        // Find college by code
        const college = await tx.college.findUnique({
          where: { code: collegeCode }
        });

        if (!college) {
          throw new Error('College not found with the provided code');
        }

        // Create student record
        await tx.student.create({
          data: {
            userId: user.id,
            collegeId: college.id,
            rollNo,
            branch
          }
        });
      } else if (role === 'COMPANY') {
        // Company profile will be created separately via company registration
      }

      return user;
    });

    // Generate token
    const token = generateToken({
      id: result.id,
      email: result.email,
      role: result.role
    });

    // Send welcome email
    try {
      await sendWelcomeEmail(email, firstName, role);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: result.id,
        email: result.email,
        role: result.role
      }
    });
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { email, password } = value;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
        college: true,
        company: true
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.profile,
        college: user.college,
        company: user.company
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        profile: true,
        college: true,
        company: true,
        students: {
          include: {
            college: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.profile,
        college: user.college,
        company: user.company,
        students: user.students
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get colleges for student registration
router.get('/colleges', async (req, res, next) => {
  try {
    const colleges = await prisma.college.findMany({
      where: { isVerified: true },
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
        state: true
      }
    });

    res.json({ colleges });
  } catch (error) {
    next(error);
  }
});

export default router;
