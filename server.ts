import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { Prisma } from "./generated/prisma/client";
import { prisma } from "./lib/prisma";

const publicDir = join(process.cwd(), "public");
const port = Number(process.env.PORT ?? 3000);

type UserInput = {
  name?: string;
  email?: string;
  postTitle?: string;
  postContent?: string;
};

function sendJson(response: ServerResponse, statusCode: number, data: unknown) {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(data));
}

function sendError(response: ServerResponse, statusCode: number, message: string) {
  sendJson(response, statusCode, { error: message });
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const body = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(body || "{}") as T;
}

function getUserId(pathname: string) {
  const match = pathname.match(/^\/api\/users\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function getPostId(pathname: string) {
  const match = pathname.match(/^\/api\/posts\/(\d+)\/toggle$/);
  return match ? Number(match[1]) : null;
}

async function listUsers(response: ServerResponse) {
  const users = await prisma.user.findMany({
    include: {
      posts: {
        orderBy: {
          id: "asc",
        },
      },
    },
    orderBy: {
      id: "asc",
    },
  });

  sendJson(response, 200, users);
}

async function createUser(request: IncomingMessage, response: ServerResponse) {
  const input = await readJson<UserInput>(request);
  const email = input.email?.trim().toLowerCase();
  const name = input.name?.trim();
  const postTitle = input.postTitle?.trim();
  const postContent = input.postContent?.trim();

  if (!email) {
    sendError(response, 400, "Email is required.");
    return;
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      posts: postTitle
        ? {
            create: {
              title: postTitle,
              content: postContent || null,
            },
          }
        : undefined,
    },
    include: {
      posts: true,
    },
  });

  sendJson(response, 201, user);
}

async function updateUser(request: IncomingMessage, response: ServerResponse, id: number) {
  const input = await readJson<UserInput>(request);
  const email = input.email?.trim().toLowerCase();
  const name = input.name?.trim();

  if (!email) {
    sendError(response, 400, "Email is required.");
    return;
  }

  const user = await prisma.user.update({
    where: {
      id,
    },
    data: {
      email,
      name: name || null,
    },
    include: {
      posts: true,
    },
  });

  sendJson(response, 200, user);
}

async function deleteUser(response: ServerResponse, id: number) {
  await prisma.post.deleteMany({
    where: {
      authorId: id,
    },
  });

  await prisma.user.delete({
    where: {
      id,
    },
  });

  sendJson(response, 200, { deleted: true });
}

async function togglePost(response: ServerResponse, id: number) {
  const post = await prisma.post.findUnique({
    where: {
      id,
    },
  });

  if (!post) {
    sendError(response, 404, "Post not found.");
    return;
  }

  const updatedPost = await prisma.post.update({
    where: {
      id,
    },
    data: {
      published: !post.published,
    },
  });

  sendJson(response, 200, updatedPost);
}

async function serveStatic(pathname: string, response: ServerResponse) {
  const filePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const fullPath = join(publicDir, filePath);
  const extension = extname(fullPath);
  const contentTypes: Record<string, string> = {
    ".css": "text/css",
    ".html": "text/html",
    ".js": "text/javascript",
  };

  try {
    const file = await readFile(fullPath);
    response.writeHead(200, {
      "Content-Type": contentTypes[extension] ?? "text/plain",
    });
    response.end(file);
  } catch {
    sendError(response, 404, "Page not found.");
  }
}

async function handleRequest(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  const userId = getUserId(url.pathname);
  const postId = getPostId(url.pathname);

  try {
    if (request.method === "GET" && url.pathname === "/api/users") {
      await listUsers(response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/users") {
      await createUser(request, response);
      return;
    }

    if (request.method === "PUT" && userId) {
      await updateUser(request, response, userId);
      return;
    }

    if (request.method === "DELETE" && userId) {
      await deleteUser(response, userId);
      return;
    }

    if (request.method === "PATCH" && postId) {
      await togglePost(response, postId);
      return;
    }

    if (request.method === "GET") {
      await serveStatic(url.pathname, response);
      return;
    }

    sendError(response, 405, "Method not allowed.");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        sendError(response, 409, "That email is already being used.");
        return;
      }

      if (error.code === "P2025") {
        sendError(response, 404, "Record not found.");
        return;
      }
    }

    console.error(error);
    sendError(response, 500, "Something went wrong.");
  }
}

const server = createServer(handleRequest);

server.listen(port, () => {
  console.log(`Prisma CRUD app running at http://localhost:${port}`);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  server.close(() => {
    process.exit(0);
  });
});
