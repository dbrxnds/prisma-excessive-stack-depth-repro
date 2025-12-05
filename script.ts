import "dotenv/config";
import { Prisma, PrismaClient } from "./prisma/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: pool });
const prismaWithExtension = prisma.$extends({});

async function getFn<T extends Prisma.UserSelect>(select: T) {
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

const { foo, bar } = await getFn({
  id: true,
});
