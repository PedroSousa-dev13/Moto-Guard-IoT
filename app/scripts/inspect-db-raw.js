const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    
    console.log('--- Custom Types (Enums) ---');
    const typesRes = await client.query(`
      SELECT n.nspname as schema, t.typname as type_name
      FROM pg_type t 
      LEFT JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE (t.typtype = 'e')
    `);
    console.table(typesRes.rows);

  } catch (error) {
    console.error('Error querying DB:', error);
  } finally {
    await client.end();
  }
}

main();
