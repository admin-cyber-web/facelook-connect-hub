import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ Error: DATABASE_URL missing hai aapke .env file mein!");
  process.exit(1);
}

const sql = postgres(connectionString);

async function fixFriendshipsTable() {
  console.log("⚡ Connecting to Supabase Database to fix Friendships schema...");

  try {
    // 1. Pehle check karte hain agar table nahi hai toh complete standard structure ke sath bana dein
    await sql`
      CREATE TABLE IF NOT EXISTS public.friendships (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          sender_id UUID NOT NULL,
          receiver_id UUID NOT NULL,
          status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'blocked'
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
      );
    `;
    console.log("✅ Table 'friendships' checked/created successfully!");

    // 2. Agar table pehle se bani hui hai par 'receiver_id' column missing hai, toh use add karenge
    // Isko safe rakhne ke liye exception block handle kiya hai agar column already exist karega toh crash nahi hoga
    await sql`
      DO $$ 
      BEGIN 
          BEGIN
              ALTER TABLE public.friendships ADD COLUMN receiver_id UUID;
              RAISE NOTICE 'Column receiver_id added.';
          EXCEPTION 
              WHEN duplicate_column THEN 
                  RAISE NOTICE 'Column receiver_id already exists, skipping.';
          END;
      END $$;
    `;
    console.log("✅ Column 'receiver_id' verification/patch completed!");

    // 3. Realtime replication enable kar dete hain taaki friend request aate hi notification live kude
    await sql`ALTER TABLE public.friendships REPLICA IDENTITY FULL;`;
    console.log("✅ Friendships Realtime Replication configured!");

    console.log("\n🎉 Kamaal ho gaya! Friend Request wala database error fix ho gaya hai.");

  } catch (error) {
    console.error("❌ Database script chalane mein dikkat aayi:", error.message);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

fixFriendshipsTable();