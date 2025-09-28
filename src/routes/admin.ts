import express from 'express';
import { authenticate, AuthRequest, authorizeAdmin } from '../middleware/auth';
import { collegeSchema } from '../utils/validation';
import { prisma } from '../lib/prisma';

const router = express.Router();

// Register college
router.post('/college', authenticate, authorizeAdmin, async (req: AuthRequest, res, next) => {
  try {
    const { error, value } = collegeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    // Check if college already exists
    const existingCollege = await prisma.college.findUnique({
      where: { code: value.code }
    });

    if (existingCollege) {
      return res.status(400).json({ message: 'College with this code already exists' });
    }

    // Check if admin already has a college
    const existingAdminCollege = await prisma.college.findUnique({
      where: { adminId: req.user!.id }
    });

    if (existingAdminCollege) {
      return res.status(400).json({ message: 'You are already registered as admin for a college' });
    }

    const college = await prisma.college.create({
      data: {
        ...value,
        adminId: req.user!.id
      }
    });

    res.status(201).json({
      message: 'College registered successfully',
      college
    });
  } catch (error) {
    next(error);
  }
});

// Get college details
router.get('/college', authenticate, authorizeAdmin, async (req: AuthRequest, res, next) => {
  try {
    const college = await prisma.college.findUnique({
      where: { adminId: req.user!.id },
      include: {
        students: {
          include: {
            user: {
              include: {
                profile: true
              }
            }
          }
        },
        opportunities: {
          include: {
            company: true,
            applications: true
          }
        }
      }
    });

    if (!college) {
      return res.status(404).json({ message: 'College not found. Please register your college first.' });
    }

    res.json({ college });
  } catch (error) {
    next(error);
  }
});

// Get dashboard statistics
router.get('/dashboard', authenticate, authorizeAdmin, async (req: AuthRequest, res, next) => {
  try {
    const college = await prisma.college.findUnique({
      where: { adminId: req.user!.id }
    });

    if (!college) {
      return res.status(404).json({ message: 'College not found' });
    }

    // Get student statistics
    const totalStudents = await prisma.student.count({
      where: { collegeId: college.id }
    });

    const placedStudents = await prisma.profile.count({
      where: {
        user: {
          students: {
            some: {
              collegeId: college.id
            }
          }
        },
        isPlaced: true
      }
    });

    const unplacedStudents = totalStudents - placedStudents;

    // Get opportunity statistics
    const totalOpportunities = await prisma.opportunity.count({
      where: { collegeId: college.id }
    });

    const activeOpportunities = await prisma.opportunity.count({
      where: {
        collegeId: college.id,
        isActive: true,
        applicationDeadline: {
          gt: new Date()
        }
      }
    });

    // Get application statistics
    const totalApplications = await prisma.application.count({
      where: {
        opportunity: {
          collegeId: college.id
        }
      }
    });

    const applicationsByStatus = await prisma.application.groupBy({
      by: ['status'],
      where: {
        opportunity: {
          collegeId: college.id
        }
      },
      _count: {
        status: true
      }
    });

    // Get company-wise placement statistics
    const companyStats = await prisma.profile.groupBy({
      by: ['placedAt'],
      where: {
        isPlaced: true,
        user: {
          students: {
            some: {
              collegeId: college.id
            }
          }
        }
      },
      _count: {
        placedAt: true
      }
    });

    // Get department-wise statistics
    const departmentStats = await prisma.student.groupBy({
      by: ['branch'],
      where: { collegeId: college.id },
      _count: {
        branch: true
      }
    });

    res.json({
      college,
      statistics: {
        students: {
          total: totalStudents,
          placed: placedStudents,
          unplaced: unplacedStudents,
          placementRate: totalStudents > 0 ? Math.round((placedStudents / totalStudents) * 100) : 0
        },
        opportunities: {
          total: totalOpportunities,
          active: activeOpportunities
        },
        applications: {
          total: totalApplications,
          byStatus: applicationsByStatus.map(stat => ({
            status: stat.status,
            count: stat._count.status
          }))
        },
        companyStats: companyStats.map(stat => ({
          company: stat.placedAt,
          count: stat._count.placedAt
        })),
        departmentStats: departmentStats.map(stat => ({
          branch: stat.branch,
          count: stat._count.branch
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get all students
router.get('/students', authenticate, authorizeAdmin, async (req: AuthRequest, res, next) => {
  try {
    const { page = 1, limit = 20, branch, placed } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const college = await prisma.college.findUnique({
      where: { adminId: req.user!.id }
    });

    if (!college) {
      return res.status(404).json({ message: 'College not found' });
    }

    const where: any = {
      collegeId: college.id
    };

    if (branch) {
      where.branch = branch;
    }

    if (placed !== undefined) {
      where.user = {
        profile: {
          isPlaced: placed === 'true'
        }
      };
    }

    const students = await prisma.student.findMany({
      where,
      include: {
        user: {
          include: {
            profile: true,
            applications: {
              include: {
                opportunity: {
                  include: {
                    company: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit)
    });

    const total = await prisma.student.count({ where });

    res.json({
      students,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get opportunities posted by admin
router.get('/opportunities', authenticate, authorizeAdmin, async (req: AuthRequest, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const college = await prisma.college.findUnique({
      where: { adminId: req.user!.id }
    });

    if (!college) {
      return res.status(404).json({ message: 'College not found' });
    }

    const opportunities = await prisma.opportunity.findMany({
      where: { collegeId: college.id },
      include: {
        company: true,
        applications: {
          include: {
            student: {
              include: {
                profile: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit)
    });

    const total = await prisma.opportunity.count({
      where: { collegeId: college.id }
    });

    res.json({
      opportunities,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Generate college invite link
router.get('/invite-link', authenticate, authorizeAdmin, async (req: AuthRequest, res, next) => {
  try {
    const college = await prisma.college.findUnique({
      where: { adminId: req.user!.id }
    });

    if (!college) {
      return res.status(404).json({ message: 'College not found' });
    }

    const inviteLink = `${process.env.FRONTEND_URL}/register?college=${college.code}`;

    res.json({
      inviteLink,
      collegeCode: college.code,
      collegeName: college.name
    });
  } catch (error) {
    next(error);
  }
});

export default router;
