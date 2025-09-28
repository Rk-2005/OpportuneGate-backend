const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function setup() {
  try {
    console.log('Setting up test data...');

    // Create admin user first
    const adminPassword = await bcrypt.hash('admin123', 12);
    const admin = await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: {},
      create: {
        email: 'admin@example.com',
        password: adminPassword,
        role: 'ADMIN',
        isActive: true
      }
    });

    // Create admin profile
    await prisma.profile.upsert({
      where: { userId: admin.id },
      update: {},
      create: {
        userId: admin.id,
        firstName: 'Admin',
        lastName: 'User',
        phone: '9876543210'
      }
    });

    // Create a test college with admin
    const college = await prisma.college.upsert({
      where: { code: 'TEST001' },
      update: {},
      create: {
        name: 'Test Engineering College',
        code: 'TEST001',
        address: '123 Test Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        website: 'https://testcollege.edu',
        isVerified: true,
        adminId: admin.id
      }
    });

    console.log('✅ College created:', college.name);

    console.log('✅ Admin user created:', admin.email);

    // Create student user
    const studentPassword = await bcrypt.hash('admin123', 12);
    const student = await prisma.user.upsert({
      where: { email: 'student@example.com' },
      update: {},
      create: {
        email: 'student@example.com',
        password: studentPassword,
        role: 'STUDENT',
        isActive: true
      }
    });

    // Create student profile
    await prisma.profile.upsert({
      where: { userId: student.id },
      update: {},
      create: {
        userId: student.id,
        firstName: 'John',
        lastName: 'Doe',
        phone: '9876543211',
        cgpa: 8.5,
        currentYear: 3
      }
    });

    // Create student record
    await prisma.student.upsert({
      where: { userId: student.id },
      update: {},
      create: {
        userId: student.id,
        collegeId: college.id,
        rollNo: 'CS2021001',
        branch: 'CSE'
      }
    });

    // Create student profile
    await prisma.profile.upsert({
      where: { userId: student.id },
      update: {},
      create: {
        userId: student.id,
        firstName: 'John',
        lastName: 'Doe',
        phone: '+91-9876543210',
        sscPercent: 85.5,
        hscPercent: 78.0,
        cgpa: 8.5,
        currentYear: 3,
        resume: 'https://example.com/resume.pdf',
        documents: ['resume.pdf', 'certificate.pdf']
      }
    });

    console.log('✅ Student user created:', student.email);

    // Create company user
    const companyPassword = await bcrypt.hash('company123', 12);
    const companyUser = await prisma.user.upsert({
      where: { email: 'hr@techcorp.com' },
      update: {},
      create: {
        email: 'hr@techcorp.com',
        password: companyPassword,
        role: 'COMPANY',
        isActive: true
      }
    });

    // Create company profile
    await prisma.profile.upsert({
      where: { userId: companyUser.id },
      update: {},
      create: {
        userId: companyUser.id,
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '9876543212'
      }
    });

    // Create company record
    await prisma.company.upsert({
      where: { userId: companyUser.id },
      update: {},
      create: {
        userId: companyUser.id,
        name: 'TechCorp Solutions',
        website: 'https://techcorp.com',
        industry: 'Technology',
        size: '100-500',
        description: 'Leading technology solutions provider',
        isVerified: true
      }
    });

    console.log('✅ Company user created:', companyUser.email);

    // Create a test opportunity
    const opportunity = await prisma.opportunity.create({
      data: {
        title: 'Software Developer Internship',
        description: 'Join our team as a software developer intern and work on exciting projects.',
        type: 'INTERNSHIP',
        location: 'Mumbai, Maharashtra',
        salary: '₹25,000/month',
        duration: '6 months',
        applicationDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        postedBy: admin.id,
        collegeId: college.id,
        eligibility: {
          minCGPA: 7.0,
          year: '3',
          branch: 'CSE'
        },
        requirements: ['JavaScript', 'React', 'Node.js', 'Problem Solving'],
        benefits: ['Mentorship', 'Certificate', 'Stipend', 'Learning Opportunities']
      }
    });

    console.log('✅ Test opportunity created:', opportunity.title);

    // Create a test application
    const application = await prisma.application.create({
      data: {
        studentId: student.id,
        opportunityId: opportunity.id,
        status: 'APPLIED'
      }
    });

    console.log('✅ Test application created');

    console.log('\n🎉 Setup completed successfully!');
    console.log('\nTest Accounts:');
    console.log('Admin: admin@example.com / admin123');
    console.log('Student: student@example.com / admin123');
    console.log('Company: hr@techcorp.com / company123');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setup();