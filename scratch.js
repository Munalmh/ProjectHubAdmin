const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.findMany().then(u => {
  console.log(u);
  prisma.$disconnect();
}).catch(e => {
  console.error(e);
  prisma.$disconnect();
});
