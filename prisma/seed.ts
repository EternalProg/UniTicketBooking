import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";

function buildAdapter(): PrismaMariaDb {
  const url = new URL(process.env["DATABASE_URL"] ?? "mysql://root:root@localhost:3306/ticket_booking");

  return new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port) || 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: 5,
  });
}

const prisma = new PrismaClient({ adapter: buildAdapter() });

async function main() {
  console.log("Seeding database...");

  const adminPassword = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@university.edu" },
    update: {},
    create: {
      email: "admin@university.edu",
      password: adminPassword,
      name: "Admin User",
      role: "ADMIN",
    },
  });

  console.log(`Created admin: ${admin.email}`);

  const userPassword = await bcrypt.hash("user123", 12);
  const user = await prisma.user.upsert({
    where: { email: "user@example.com" },
    update: {},
    create: {
      email: "user@example.com",
      password: userPassword,
      name: "Test User",
      role: "USER",
    },
  });

  console.log(`Created user: ${user.email}`);

  const events = [
    {
      title: "Spring Music Concert",
      description: "Annual spring concert featuring university orchestra and choir",
      date: new Date("2026-05-15T18:00:00Z"),
      location: "University Main Hall",
      totalTickets: 200,
      availableTickets: 200,
      price: 15.0,
      category: "Music",
      createdById: admin.id,
    },
    {
      title: "Theatre Performance: Hamlet",
      description: "Student theatre group presents Shakespeare's classic tragedy",
      date: new Date("2026-04-20T19:30:00Z"),
      location: "University Theatre",
      totalTickets: 150,
      availableTickets: 150,
      price: 10.0,
      category: "Theatre",
      createdById: admin.id,
    },
    {
      title: "Art Exhibition: Modern Perspectives",
      description: "Showcase of student artwork exploring contemporary themes",
      date: new Date("2026-06-01T10:00:00Z"),
      location: "University Art Gallery",
      totalTickets: 100,
      availableTickets: 100,
      price: 5.0,
      category: "Art",
      createdById: admin.id,
    },
    {
      title: "Science Week Opening Ceremony",
      description: "Keynote speech and demonstrations to open the annual Science Week",
      date: new Date("2026-03-10T09:00:00Z"),
      location: "University Conference Center",
      totalTickets: 300,
      availableTickets: 300,
      price: 0,
      category: "Science",
      createdById: admin.id,
    },
    {
      title: "Dance Showcase: Rhythms of the World",
      description: "Traditional and modern dance performances from around the globe",
      date: new Date("2026-05-30T17:00:00Z"),
      location: "University Sports Complex",
      totalTickets: 250,
      availableTickets: 250,
      price: 8.0,
      category: "Dance",
      createdById: admin.id,
    },
  ];

  for (const eventData of events) {
    const event = await prisma.event.create({ data: eventData });
    console.log(`Created event: ${event.title} ($${event.price})`);
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
