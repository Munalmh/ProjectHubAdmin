const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.project.findMany().then(p => {
  console.log(p.map(x => ({ name: x.name, status: x.status })));
  prisma.$disconnect();
}).catch(e => {
  console.error(e);
  prisma.$disconnect();
});
