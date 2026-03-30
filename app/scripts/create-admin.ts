/**
 * P6.5: Create initial admin account for production
 * Usage: npx tsx scripts/create-admin.ts <email> <password> <name>
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

async function main() {
  const [email, password, ...nameParts] = process.argv.slice(2);
  const name = nameParts.join(" ");

  if (!email || !password || !name) {
    console.error("Usage: npx tsx scripts/create-admin.ts <email> <password> <name>");
    console.error("Example: npx tsx scripts/create-admin.ts admin@example.com securepass123 Admin User");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Error: Password must be at least 8 characters.");
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.isAdmin) {
        console.log(`Admin account already exists for ${email}`);
        return;
      }
      // Promote existing user to admin
      await prisma.user.update({
        where: { email },
        data: { isAdmin: true },
      });
      console.log(`Promoted existing user ${email} to admin.`);
      return;
    }

    const passwordHash = await hash(password, 12);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        isAdmin: true,
        emailVerified: true,
        onboarded: false,
      },
    });

    console.log(`Admin account created: ${email}`);
  } catch (error) {
    console.error("Failed to create admin:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
