import "dotenv/config";
import { Prisma, PrismaClient } from "./prisma/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { prismaEffectExtension } from "./extension";

const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: pool });
const prismaWithExtension = prisma.$extends(prismaEffectExtension);

async function foo(select: Prisma.UserSelect) {
  const foo = await prisma.user.findFirst({
    where: {
      email: "test@test.com",
    },
    select,
  });

  const bar = await prismaWithExtension.user.findFirst({
    where: {
      email: "test@test.com",
    },
    select,
  });

  return { foo, bar };
}
