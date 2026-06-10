const path = require('path');
const { createRequire } = require('module');
const dotenv = require('dotenv');
const backendRequire = createRequire(path.resolve(__dirname, '../../uc-talent-backend/package.json'));
const { Client } = backendRequire('pg');

dotenv.config({ path: path.resolve(__dirname, '../../uc-talent-backend/.env') });

const userId = 'SYija6DY5A12COmG4QMAi';
const wallet = '0xf2344D1fDc0DA76aEd22231a02848280A949982e';
const closedAt = new Date(Date.now() - 24 * 60 * 60 * 1000);

const client = new Client({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  user: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});

async function upsertSeedData() {
  await client.connect();
  await client.query('begin');

  await client.query("delete from payment_distributions where id like 'e2e-%'");
  await client.query("delete from job_applies where id like 'e2e-%'");
  await client.query("delete from job_referrals where id like 'e2e-%'");
  await client.query("delete from jobs where id like 'e2e-%'");
  await client.query("delete from organizations where id = 'e2e-org-claim'");

  await client.query(
    `insert into organizations (id, name, website, status, created_at, updated_at)
     values ($1, $2, $3, $4, now(), now())`,
    ['e2e-org-claim', 'E2E Claim Org', 'https://uctalent.dev', 'approved']
  );

  const jobs = [
    ['e2e-job-referral-claim', 'E2E Referral Claim Job', 2001],
    ['e2e-job-apply-claim', 'E2E Apply Claim Job', 2002],
    ['e2e-job-reclaim', 'E2E Reclaim Job', 2003],
  ];

  for (const [id, title, jobNumber] of jobs) {
    await client.query(
      `insert into jobs (
        id, title, experience_level, management_level, location_value,
        location_type, job_type, responsibilities, minimum_qualifications,
        status, posted_date, expired_date, created_at, updated_at,
        organization_id, salary_from_cents, salary_from_currency,
        salary_to_cents, salary_to_currency, apply_method, about, created_by,
        referral_cents, referral_currency, chain_id, address_token,
        referral_type, referral_info, job_number, referral_visibility,
        referral_net_cents, closed_at, is_web3_job
      )
      values (
        $1, $2, 1, 1, 'Remote', 'remote', 'Full-Time',
        'E2E responsibilities', 'E2E qualifications', 'published',
        now(), now() + interval '30 days', now(), now(), $3,
        0, 'USD', 0, 'USD', 'internal', 'E2E web3 claim test', $4,
        $5, 'COTI', 'coti-testnet',
        '0x0000000000000000000000000000000000000000',
        'deposit', '{}'::jsonb, $6, 'public', $7, $8, true
      )`,
      [
        id,
        title,
        'e2e-org-claim',
        userId,
        '1000000000000000000',
        jobNumber,
        '800000000000000000',
        closedAt,
      ]
    );
  }

  await client.query(
    `insert into job_referrals (
      id, job_id, referrer_id, candidate_name, candidate_email,
      candidate_phonenumber, candidate_introduction, recommendation,
      created_at, updated_at, reward_address, is_on_chain_verified
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, now(), now(), $9, true)`,
    [
      'e2e-referral-claim',
      'e2e-job-referral-claim',
      userId,
      'E2E Candidate Referral',
      'e2e-referral-candidate@example.com',
      '000',
      'E2E intro',
      'E2E recommendation',
      wallet,
    ]
  );

  await client.query(
    `insert into job_applies (
      id, talent_id, job_id, organization_id, status, created_at, updated_at,
      email, job_referral_id, reward_address, is_on_chain_verified
    )
    values
      ($1, $2, $3, $4, 'hired', now(), now(), $5, $6, $7, true),
      ($8, $9, $10, $11, 'hired', now(), now(), $12, null, $13, true)`,
    [
      'e2e-apply-for-referral',
      'e2e-candidate-talent',
      'e2e-job-referral-claim',
      'e2e-org-claim',
      'e2e-referral-candidate@example.com',
      'e2e-referral-claim',
      wallet,
      'e2e-apply-claim',
      userId,
      'e2e-job-apply-claim',
      'e2e-org-claim',
      'yugodevbc@uctalent.io',
      wallet,
    ]
  );

  const payments = [
    ['e2e-pay-referrer', 'e2e-job-referral-claim', 'referrer', userId, '800000000000000000'],
    ['e2e-pay-candidate', 'e2e-job-apply-claim', 'candidate', userId, '800000000000000000'],
    ['e2e-pay-hiring-manager', 'e2e-job-reclaim', 'hiring_manager', userId, '800000000000000000'],
    ['e2e-pay-platform-1', 'e2e-job-referral-claim', 'platform_fee', null, '200000000000000000'],
    ['e2e-pay-platform-2', 'e2e-job-apply-claim', 'platform_fee', null, '200000000000000000'],
    ['e2e-pay-platform-3', 'e2e-job-reclaim', 'platform_fee', null, '200000000000000000'],
  ];

  for (const [id, jobId, role, recipientId, amount] of payments) {
    await client.query(
      `insert into payment_distributions (
        id, amount_cents, amount_currency, percentage, payment_type, status,
        role, job_id, recipient_type, recipient_id, created_at, updated_at
      )
      values ($1, $2, 'COTI', 80, 'referral_reward', 'claimable', $3, $4, 'user', $5, now(), now())`,
      [id, amount, role, jobId, recipientId]
    );
  }

  await client.query('commit');

  const seededJobs = await client.query(
    "select id, title, job_number, is_web3_job, referral_type, closed_at from jobs where id like 'e2e-%' order by id"
  );
  const seededPayments = await client.query(
    "select id, job_id, role, recipient_id, status from payment_distributions where id like 'e2e-%' order by id"
  );

  console.table(seededJobs.rows);
  console.table(seededPayments.rows);
}

upsertSeedData()
  .catch(async (error) => {
    try {
      await client.query('rollback');
    } catch {}
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
