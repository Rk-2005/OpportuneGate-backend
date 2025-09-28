import express from 'express';
// ApplicationStatus type is defined in the schema
type ApplicationStatus = 'APPLIED' | 'APTITUDE' | 'TECHNICAL' | 'INTERVIEW' | 'PLACED' | 'NOT_PLACED' | 'REJECTED';
import { authenticate, AuthRequest, authorizeStudent } from '../middleware/auth';
import { applicationSchema } from '../utils/validation';
import { prisma } from '../lib/prisma';

const router = express.Router();

// Apply to opportunity
router.post('/', authenticate, authorizeStudent, async (req: AuthRequest, res, next) => {
  try {
    const { error, value } = applicationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { opportunityId } = value;

    // Check if opportunity exists and is active
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId }
    });

    if (!opportunity || !opportunity.isActive) {
      return res.status(404).json({ message: 'Opportunity not found or inactive' });
    }

    // Check if application deadline has passed
    if (new Date() > opportunity.applicationDeadline) {
      return res.status(400).json({ message: 'Application deadline has passed' });
    }

    // Check if already applied
    const existingApplication = await prisma.application.findUnique({
      where: {
        studentId_opportunityId: {
          studentId: req.user!.id,
          opportunityId
        }
      }
    });

    if (existingApplication) {
      return res.status(400).json({ message: 'You have already applied to this opportunity' });
    }

    // Check eligibility
    const studentProfile = await prisma.profile.findUnique({
      where: { userId: req.user!.id }
    });

    if (studentProfile && opportunity.eligibility) {
      const eligibility = opportunity.eligibility as any;
      const reasons = [];

      // Check CGPA
      if (eligibility.minCGPA && studentProfile.cgpa) {
        if (studentProfile.cgpa < eligibility.minCGPA) {
          reasons.push(`Minimum CGPA required: ${eligibility.minCGPA}, Your CGPA: ${studentProfile.cgpa}`);
        }
      }

      // Check SSC Percentage
      if (eligibility.minSSC && studentProfile.sscPercent) {
        if (studentProfile.sscPercent < eligibility.minSSC) {
          reasons.push(`Minimum SSC % required: ${eligibility.minSSC}, Your SSC %: ${studentProfile.sscPercent}`);
        }
      }

      // Check HSC Percentage
      if (eligibility.minHSC && studentProfile.hscPercent) {
        if (studentProfile.hscPercent < eligibility.minHSC) {
          reasons.push(`Minimum HSC % required: ${eligibility.minHSC}, Your HSC %: ${studentProfile.hscPercent}`);
        }
      }

      // Check Year
        console.log("hooooo")
        console.log(studentProfile.currentYear)
        console.log(eligibility.year)
      if (eligibility.year && studentProfile.currentYear) {
      
        if ((studentProfile.currentYear)!== Number(eligibility.year)) {
          reasons.push(`Required year: ${eligibility.year}, Your year: ${studentProfile.currentYear}`);
        }
      }

      // Check Branch
      if (eligibility.branch && (studentProfile as any).branch) {
        const requiredBranches = Array.isArray(eligibility.branch) ? eligibility.branch : [eligibility.branch];
        if (!requiredBranches.includes((studentProfile as any).branch)) {
          reasons.push(`Required branch: ${requiredBranches.join(', ')}, Your branch: ${(studentProfile as any).branch}`);
        }
      }

      if (reasons.length > 0) {
        return res.status(400).json({ 
          message: 'You are not eligible for this opportunity',
          reasons: reasons
        });
      }
    }

    // Create application
    const application = await prisma.application.create({
      data: {
        studentId: req.user!.id,
        opportunityId,
        status: 'APPLIED'
      },
      include: {
        opportunity: {
          include: {
            company: true,
            college: true
          }
        }
      }
    });

    // Create notification for the opportunity poster
    await prisma.notification.create({
      data: {
        userId: opportunity.postedBy,
        opportunityId: opportunity.id,
        title: 'New Application Received',
        message: `A new application has been received for "${opportunity.title}".`,
        type: 'application'
      }
    });

    // Emit real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${opportunity.postedBy}`).emit('notification', {
        title: 'New Application Received',
        message: `A new application has been received for "${opportunity.title}".`,
        type: 'APPLICATION',
        applicationId: application.id
      });
    }

    res.status(201).json({
      message: 'Application submitted successfully',
      application
    });
  } catch (error) {
    next(error);
  }
});

// Get user's applications
router.get('/my-applications', authenticate, authorizeStudent, async (req: AuthRequest, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      studentId: req.user!.id
    };

    if (status) {
      where.status = status as ApplicationStatus;
    }

    const applications = await prisma.application.findMany({
      where,
      include: {
        opportunity: {
          include: {
            company: {
              select: {
                name: true,
                website: true,
                industry: true
              }
            },
            college: {
              select: {
                name: true,
                city: true,
                state: true
              }
            }
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

// Get applications for an opportunity (admin/company view)
router.get('/opportunity/:opportunityId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { opportunityId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Check if user has permission to view these applications
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId }
    });

    if (!opportunity) {
      return res.status(404).json({ message: 'Opportunity not found' });
    }

    // Only the poster or admin can view applications
    if (opportunity.postedBy !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Not authorized to view these applications' });
    }

    const where: any = {
      opportunityId
    };

    if (status) {
      where.status = status as ApplicationStatus;
    }

    const applications = await prisma.application.findMany({
      where,
      include: {
        student: {
          include: {
            profile: true
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

// Update application status (admin/company)
router.patch('/:id/status', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes, interviewDate, interviewTime } = req.body;

    const validStatuses = ['APPLIED', 'APTITUDE', 'TECHNICAL', 'INTERVIEW', 'PLACED', 'NOT_PLACED', 'REJECTED'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // Check if user has permission to update this application
    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        opportunity: true
      }
    });

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Only the opportunity poster or admin can update status
    if (application.opportunity.postedBy !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Not authorized to update this application' });
    }

    const updateData: any = { status };
    
    if (notes) updateData.notes = notes;
    if (interviewDate) updateData.interviewDate = new Date(interviewDate);
    if (interviewTime) updateData.interviewTime = interviewTime;

    const updatedApplication = await prisma.application.update({
      where: { id },
      data: updateData,
      include: {
        student: {
          include: {
            profile: true
          }
        },
        opportunity: {
          include: {
            company: true,
            college: true
          }
        }
      }
    });

    // Create notification for student
    await prisma.notification.create({
      data: {
        userId: application.studentId,
        opportunityId: application.opportunityId,
        title: 'Application Status Updated',
        message: `Your application for "${application.opportunity.title}" has been updated to ${status}.`,
        type: 'status_update'
      }
    });

    // If placed, update student profile
    if (status === 'PLACED') {
      await prisma.profile.update({
        where: { userId: application.studentId },
        data: {
          isPlaced: true,
          placedAt: (application.opportunity as any).company?.name || (application.opportunity as any).college?.name || 'Unknown'
        }
      });
    }

    res.json({
      message: 'Application status updated successfully',
      application: updatedApplication
    });
  } catch (error) {
    next(error);
  }
});

// Get application statistics
router.get('/stats/overview', authenticate, async (req: AuthRequest, res, next) => {
  try {
    let where: any = {};

    if (req.user!.role === 'STUDENT') {
      where.studentId = req.user!.id;
    } else if (req.user!.role === 'ADMIN') {
      // Get applications for opportunities posted by this admin's college
      const college = await prisma.college.findUnique({
        where: { adminId: req.user!.id }
      });
      
      if (college) {
        where.opportunity = {
          collegeId: college.id
        };
      }
    } else if (req.user!.role === 'COMPANY') {
      // Get applications for opportunities posted by this company
      const company = await prisma.company.findUnique({
        where: { userId: req.user!.id }
      });
      
      if (company) {
        where.opportunity = {
          companyId: company.id
        };
      }
    }

    const stats = await prisma.application.groupBy({
      by: ['status'],
      where,
      _count: {
        status: true
      }
    });

    const totalApplications = await prisma.application.count({ where });

    res.json({
      stats: stats.map((stat: any) => ({
        status: stat.status,
        count: stat._count.status
      })),
      totalApplications
    });
  } catch (error) {
    next(error);
  }
});

export default router;
