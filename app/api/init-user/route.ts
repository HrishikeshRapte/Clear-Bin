// import { NextRequest, NextResponse } from 'next/server';
// import { getUserByEmail, createUser, getRecentReports } from '@/utils/db/actions'; // adjust import if needed

// export async function POST(req: NextRequest) {
//   const { email } = await req.json();

//   if (!email) {
//     return NextResponse.json({ error: 'Email is required' }, { status: 400 });
//   }

//   // Fetch or create user
//   let user = await getUserByEmail(email);
//   if (!user) {
//     user = await createUser(email, 'Anonymous User');
//   }

//   // Get recent reports
//   const reports = await getRecentReports();

//   // Format date before sending to client
//   const formattedReports = reports.map(report => ({
//     ...report,
//     createdAt: report.createdAt.toISOString().split('T')[0],
//   }));

//   return NextResponse.json({ user, reports: formattedReports });
// }


import { NextResponse } from 'next/server';
// import { createUser, getUserByEmail, getReportsByUserId } from '@/utils/db/actions';
import { createUser, getUserByEmail, getReportsByUserId } from '../../../utils/db/actions';

export const runtime = 'edge'; // 👈 This line enables Edge Runtime

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Ensure the user exists
    await createUser(email, 'Anonymous User');

    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const reports = await getReportsByUserId(user.id);

    return NextResponse.json({ user, reports });
  } catch (error) {
    console.error('Error in /api/init-user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
