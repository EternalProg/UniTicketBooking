import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";

function buildAdapter(): PrismaMariaDb {
  const url = new URL(
    process.env["DATABASE_URL"] ?? "mysql://root:root@localhost:3306/ticket_booking",
  );

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

  const adminEmail = process.env["ADMIN_EMAIL"] ?? "admin@university.edu";
  const adminPassword = await bcrypt.hash(
    process.env["ADMIN_PASSWORD"] ?? "admin123",
    12,
  );
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: adminPassword,
      name: "Адміністратор",
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
      name: "Тестовий Користувач",
      role: "USER",
    },
  });

  console.log(`Created user: ${user.email}`);

  const events = [
    {
      title: "Весняний музичний концерт",
      description:
        "Щорічний весняний концерт за участю університетського оркестру та хору",
      date: new Date("2026-05-15T18:00:00Z"),
      location: "Головна зала університету",
      totalTickets: 200,
      availableTickets: 200,
      price: 150.0,
      category: "Музика",
      createdById: admin.id,
    },
    {
      title: "Театральна вистава: Гамлет",
      description: "Студентський театральний гурт представляє класичну трагедію Шекспіра",
      date: new Date("2026-04-20T19:30:00Z"),
      location: "Університетський театр",
      totalTickets: 150,
      availableTickets: 150,
      price: 80.0,
      category: "Театр",
      createdById: admin.id,
    },
    {
      title: "Виставка мистецтв: Сучасні перспективи",
      description: "Експозиція студентських робіт, що досліджують сучасні теми",
      date: new Date("2026-06-01T10:00:00Z"),
      location: "Художня галерея університету",
      totalTickets: 100,
      availableTickets: 100,
      price: 50.0,
      category: "Мистецтво",
      createdById: admin.id,
    },
    {
      title: "Відкриття Тижня науки",
      description: "Ключова доповідь та демонстрації на відкритті щорічного Тижня науки",
      date: new Date("2026-03-10T09:00:00Z"),
      location: "Конференц-центр університету",
      totalTickets: 300,
      availableTickets: 300,
      price: 0,
      category: "Наука",
      createdById: admin.id,
    },
    {
      title: "Танцювальне шоу: Ритми світу",
      description: "Традиційні та сучасні танцювальні виступи з різних куточків світу",
      date: new Date("2026-05-30T17:00:00Z"),
      location: "Спортивний комплекс університету",
      totalTickets: 250,
      availableTickets: 250,
      price: 100.0,
      category: "Танець",
      createdById: admin.id,
    },
  ];

  for (const eventData of events) {
    const event = await prisma.event.create({ data: eventData });
    console.log(`Created event: ${event.title} (₴${event.price})`);
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
