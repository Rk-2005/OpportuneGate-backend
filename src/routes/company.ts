import express from 'express';
import { authenticate, AuthRequest, authorizeCompany } from '../middleware/auth';
import { companySchema } from '../utils/validation';
import { prisma } from '../lib/prisma';

const router = express.Router();

// Register company profile
router.post('/profile', authenticate, authorizeCompany, async (req: AuthRequest, res, next) => {
  try {
    const { error, value } = companySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    // Check if company profile already exists
    const existingCompany = await prisma.company.findUnique({
      where: { userId: req.user!.id }
    });

    if (existingCompany) {
      return res.status(400).json({ message: 'Company profile already exists' });
    }

    const company = await prisma.company.create({
      data: {
        ...value,
        userId: req.user!.id
      }
    });

    res.status(201).json({
      message: 'Company profile created successfully',
      company
    });
  } catch (error) {
    next(error);
  }
});

// Get company profile
router.get('/profile', authenticate, authorizeCompany, async (req: AuthRequest, res, next) => {
  try {
    const company = await prisma.company.findUnique({
      where: { userId: req.user!.id },
      include: {
        opportunities: {
          include: {
            applications: {
              include: {
                student: {
                  include: {
                    profile: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!company) {
      return res.status(404).json({ message: 'Company profile not found. Please create your company profile first.' });
    }

    res.json({ company });
  } catch (error) {
    next(error);
  }
});

// Update company profile
router.put('/profile', authenticate, authorizeCompany, async (req: AuthRequest, res, next) => {
  try {
    const { error, value } = companySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const company = await prisma.company.update({
      where: { userId: req.user!.id },
      data: value
    });

    res.json({
      message: 'Company profile updated successfully',
      company
    });
  } catch (error) {
    next(error);
  }
});

// Get dashboard statistics
router.get('/dashboard', authenticate, authorizeCompany, async (req: AuthRequest, res, next) => {
  try {
    const company = await prisma.company.findUnique({
      where: { userId: req.user!.id }
    });

    if (!company) {
      return res.status(404).json({ message: 'Company profile not found' });
    }

    // Get opportunity statistics
    const totalOpportunities = await prisma.opportunity.count({
      where: { companyId: company.id }
    });

    const activeOpportunities = await prisma.opportunity.count({
      where: {
        companyId: company.id,
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
          companyId: company.id
        }
      }
    });

    const applicationsByStatus = await prisma.application.groupBy({
      by: ['status'],
      where: {
        opportunity: {
          companyId: company.id
        }
      },
      _count: {
        status: true
      }
    });

    // Get recent applications
    const recentApplications = await prisma.application.findMany({
      where: {
        opportunity: {
          companyId: company.id
        }
      },
      include: {
        student: {
          include: {
            profile: true
          }
        },
        opportunity: {
          select: {
            title: true
          }
        }
      },
      orderBy: { appliedAt: 'desc' },
      take: 10
    });

    res.json({
      company,
      statistics: {
        opportunities: {
          total: totalOpportunities,
          active: activeOpportunities
        },
        applications: {
          total: totalApplications,
        byStatus: applicationsByStatus.map((stat: any) => ({
          status: stat.status,
          count: stat._count.status
        }))
        },
        recentApplications
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get opportunities posted by company
router.get('/opportunities', authenticate, authorizeCompany, async (req: AuthRequest, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const company = await prisma.company.findUnique({
      where: { userId: req.user!.id }
    });

    if (!company) {
      return res.status(404).json({ message: 'Company profile not found' });
    }

    const opportunities = await prisma.opportunity.findMany({
      where: { companyId: company.id },
      include: {
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
      where: { companyId: company.id }
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

// Get applicants for a specific opportunity
router.get('/opportunities/:opportunityId/applicants', authenticate, authorizeCompany, async (req: AuthRequest, res, next) => {
  try {
    const { opportunityId } = req.params;
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const company = await prisma.company.findUnique({
      where: { userId: req.user!.id }
    });

    if (!company) {
      return res.status(404).json({ message: 'Company profile not found' });
    }

    // Verify that the opportunity belongs to this company
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id: opportunityId,
        companyId: company.id
      }
    });

    if (!opportunity) {
      return res.status(404).json({ message: 'Opportunity not found or not owned by your company' });
    }

    const where: any = {
      opportunityId
    };

    if (status) {
      where.status = status;
    }

    const applications = await prisma.application.findMany({
      where,
      include: {
        student: {
          include: {
            profile: true,
            college: true
          }
        }
      },
      orderBy: { appliedAt: 'desc' },
      skip,
      take: Number(limit)
    });

    const total = await prisma.application.count({ where });

    res.json({
      applications,
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

// Get all applicants across all opportunities
router.get('/applicants', authenticate, authorizeCompany, async (req: AuthRequest, res, next) => {
  try {
    const { page = 1, limit = 20, status, opportunityId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const company = await prisma.company.findUnique({
      where: { userId: req.user!.id }
    });

    if (!company) {
      return res.status(404).json({ message: 'Company profile not found' });
    }

    const where: any = {
      opportunity: {
        companyId: company.id
      }
    };

    if (status) {
      where.status = status;
    }

    if (opportunityId) {
      where.opportunityId = opportunityId;
    }

    const applications = await prisma.application.findMany({
      where,
      include: {
        student: {
          include: {
            profile: true,
            college: true
          }
        },
        opportunity: {
          select: {
            title: true,
            type: true
          }
        }
      },
      orderBy: { appliedAt: 'desc' },
      skip,
      take: Number(limit)
    });

    const total = await prisma.application.count({ where });

    res.json({
      applications,
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

export default router;
