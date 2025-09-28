import express from 'express';
import { authenticate, AuthRequest, authorizeAdmin } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import crypto from 'crypto';

const router = express.Router();

// Generate unique invite code
const generateInviteCode = () => {
  return crypto.randomBytes(8).toString('hex').toUpperCase();
};

// Create a new group
router.post('/', authenticate, authorizeAdmin, async (req: AuthRequest, res, next) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    // Generate unique invite code
    let inviteCode: string = '';
    let isUnique = false;
    while (!isUnique) {
      inviteCode = generateInviteCode();
      const existingGroup = await prisma.group.findUnique({
        where: { inviteCode }
      });
      isUnique = !existingGroup;
    }

    // Get admin's college
    const admin = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { college: true }
    });

    const group = await prisma.group.create({
      data: {
        name,
        description,
        inviteCode,
        adminId: req.user!.id,
        collegeId: admin?.college?.id
      },
      include: {
        admin: {
          include: {
            profile: true
          }
        },
        college: true,
        _count: {
          select: {
            members: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Group created successfully',
      group
    });
  } catch (error) {
    next(error);
  }
});

// Get all groups for admin
router.get('/admin', authenticate, authorizeAdmin, async (req: AuthRequest, res, next) => {
  try {
    const groups = await prisma.group.findMany({
      where: {
        adminId: req.user!.id
      },
      include: {
        admin: {
          include: {
            profile: true
          }
        },
        college: true,
        members: {
          include: {
            user: {
              include: {
                profile: true
              }
            }
          }
        },
        _count: {
          select: {
            members: true,
            opportunities: true,
            messages: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ groups });
  } catch (error) {
    next(error);
  }
});

// Get group by invite code (for students to join)
router.get('/join/:inviteCode', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { inviteCode } = req.params;

    const group = await prisma.group.findUnique({
      where: { inviteCode },
      include: {
        admin: {
          include: {
            profile: true
          }
        },
        college: true,
        _count: {
          select: {
            members: true
          }
        }
      }
    });

    if (!group) {
      return res.status(404).json({ message: 'Invalid invite code' });
    }

    if (!group.isActive) {
      return res.status(400).json({ message: 'This group is no longer active' });
    }

    res.json({ group });
  } catch (error) {
    next(error);
  }
});

// Join group by invite code
router.post('/join/:inviteCode', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { inviteCode } = req.params;

    // Check if group exists and is active
    const group = await prisma.group.findUnique({
      where: { inviteCode }
    });

    if (!group) {
      return res.status(404).json({ message: 'Invalid invite code' });
    }

    if (!group.isActive) {
      return res.status(400).json({ message: 'This group is no longer active' });
    }

    // Check if user is already a member
    const existingMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: group.id,
          userId: req.user!.id
        }
      }
    });

    if (existingMember) {
      return res.status(400).json({ message: 'You are already a member of this group' });
    }

    // Add user to group
    const groupMember = await prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId: req.user!.id
      },
      include: {
        group: {
          include: {
            admin: {
              include: {
                profile: true
              }
            }
          }
        }
      }
    });

    // Create notification for admin
    await prisma.notification.create({
      data: {
        userId: group.adminId,
        groupId: group.id,
        title: 'New Group Member',
        message: `${req.user!.email} joined your group "${group.name}"`,
        type: 'group_member_joined'
      }
    });

    res.status(201).json({
      message: 'Successfully joined the group',
      groupMember
    });
  } catch (error) {
    next(error);
  }
});

// Get user's groups
router.get('/my-groups', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const groups = await prisma.groupMember.findMany({
      where: {
        userId: req.user!.id,
        isActive: true
      },
      include: {
        group: {
          include: {
            admin: {
              include: {
                profile: true
              }
            },
            college: true,
            _count: {
              select: {
                members: true,
                opportunities: true,
                messages: true
              }
            }
          }
        }
      },
      orderBy: {
        joinedAt: 'desc'
      }
    });

    res.json({ groups: groups.map(gm => gm.group) });
  } catch (error) {
    next(error);
  }
});

// Regenerate invite code
router.patch('/:id/regenerate-invite', authenticate, authorizeAdmin, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    // Check if group belongs to admin
    const group = await prisma.group.findFirst({
      where: {
        id,
        adminId: req.user!.id
      }
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Generate new unique invite code
    let inviteCode;
    let isUnique = false;
    while (!isUnique) {
      inviteCode = generateInviteCode();
      const existingGroup = await prisma.group.findUnique({
        where: { inviteCode }
      });
      isUnique = !existingGroup;
    }

    const updatedGroup = await prisma.group.update({
      where: { id },
      data: { inviteCode },
      include: {
        admin: {
          include: {
            profile: true
          }
        },
        college: true,
        _count: {
          select: {
            members: true
          }
        }
      }
    });

    res.json({
      message: 'Invite code regenerated successfully',
      group: updatedGroup
    });
  } catch (error) {
    next(error);
  }
});

// Toggle group active status
router.patch('/:id/toggle-status', authenticate, authorizeAdmin, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    // Check if group belongs to admin
    const group = await prisma.group.findFirst({
      where: {
        id,
        adminId: req.user!.id
      }
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const updatedGroup = await prisma.group.update({
      where: { id },
      data: { isActive: !group.isActive },
      include: {
        admin: {
          include: {
            profile: true
          }
        },
        college: true,
        _count: {
          select: {
            members: true
          }
        }
      }
    });

    res.json({
      message: `Group ${updatedGroup.isActive ? 'activated' : 'deactivated'} successfully`,
      group: updatedGroup
    });
  } catch (error) {
    next(error);
  }
});

// Delete group
router.delete('/:id', authenticate, authorizeAdmin, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    // Check if group belongs to admin
    const group = await prisma.group.findFirst({
      where: {
        id,
        adminId: req.user!.id
      }
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    await prisma.group.delete({
      where: { id }
    });

    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
