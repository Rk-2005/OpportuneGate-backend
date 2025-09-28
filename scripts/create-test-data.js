const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestData() {
  try {
    console.log('Creating test opportunity and application...');

    // Get the admin user
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@testcollege.edu' }
    });

    if (!admin) {
      console.error('Admin user not found. Please run setup.js first.');
      return;
    }

    // Get the college
    const college = await prisma.college.findUnique({
      where: { code: 'TEST001' }
    });

    if (!college) {
      console.error('College not found. Please run setup.js first.');
      return;
    }

    // Create a test opportunity first
    const opportunity = await prisma.opportunity.create({
      data: {
        title: 'Software Developer Internship',
        description: 'Join our team as a software developer intern and work on exciting projects.',
        type: 'INTERNSHIP',
        location: 'Mumbai',
        salary: '25000',
        duration: '6 months',
        requirements: ['React', 'Node.js', 'JavaScript'],
        benefits: ['Mentorship', 'Certificate', 'Stipend'],
        eligibility: {
          minCGPA: 7.0,
          year: 3,
          branch: 'CSE'
        },
        applicationDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        postedBy: admin.id,
        collegeId: college.id,
        isActive: true
      }
    });

    console.log('✅ Opportunity created:', opportunity.title);

    // Get the student user
    const student = await prisma.user.findUnique({
      where: { email: 'student@testcollege.edu' }
    });

    if (!student) {
      console.error('Student user not found. Please run setup.js first.');
      return;
    }

    // Create a test application
    const application = await prisma.application.create({
      data: {
        studentId: student.id,
        opportunityId: opportunity.id,
        status: 'APPLIED',
        appliedAt: new Date()
      }
    });

    console.log('✅ Application created for student:', student.email);

    console.log('\n🎉 Test data created successfully!');
    console.log('Now you can test the "View Applicants" functionality.');

  } catch (error) {
    console.error('❌ Failed to create test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestData();
