import { prisma } from "./lib/prisma";

const demoEmail = "crud-alice@prisma.io";

async function resetDemoData() {
  await prisma.post.deleteMany({
    where: {
      author: {
        email: demoEmail,
      },
    },
  });

  await prisma.user.deleteMany({
    where: {
      email: demoEmail,
    },
  });
}

async function main() {
  await resetDemoData();

  console.log("\n1. CREATE");
  const createdUser = await prisma.user.create({
    data: {
      name: "Alice",
      email: demoEmail,
      posts: {
        create: {
          title: "Learning Prisma CRUD",
          content: "Create, read, update, and delete with PostgreSQL.",
          published: false,
        },
      },
    },
    include: {
      posts: true,
    },
  });
  console.log(createdUser);

  console.log("\n2. READ ONE");
  const foundUser = await prisma.user.findUnique({
    where: {
      email: demoEmail,
    },
    include: {
      posts: true,
    },
  });
  console.log(foundUser);

  console.log("\n3. READ MANY");
  const allUsers = await prisma.user.findMany({
    include: {
      posts: true,
    },
    orderBy: {
      id: "asc",
    },
  });
  console.log(JSON.stringify(allUsers, null, 2));

  console.log("\n4. UPDATE");
  const updatedUser = await prisma.user.update({
    where: {
      email: demoEmail,
    },
    data: {
      name: "Alice Updated",
      posts: {
        updateMany: {
          where: {
            title: "Learning Prisma CRUD",
          },
          data: {
            published: true,
          },
        },
      },
    },
    include: {
      posts: true,
    },
  });
  console.log(updatedUser);

  console.log("\n5. DELETE");
  await prisma.post.deleteMany({
    where: {
      authorId: createdUser.id,
    },
  });

  const deletedUser = await prisma.user.delete({
    where: {
      email: demoEmail,
    },
  });
  console.log(deletedUser);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
