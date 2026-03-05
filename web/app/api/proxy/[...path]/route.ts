import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8002";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params);
}

async function proxyRequest(
  request: NextRequest,
  params: { path: string[] }
) {
  const path = params.path.join("/");
  const url = new URL(request.url);
  const targetUrl = `${BACKEND_URL}/${path}${url.search}`;

  try {
    const contentType = request.headers.get("content-type") || "";
    const isFormData = contentType.includes("multipart/form-data");

    // Build headers — don't set Content-Type for FormData (browser sets boundary)
    const headers: Record<string, string> = {};
    if (!isFormData) {
      headers["Content-Type"] = contentType || "application/json";
    }
    const auth = request.headers.get("authorization");
    if (auth) {
      headers["Authorization"] = auth;
    }

    // Get request body
    let body: BodyInit | undefined;
    if (request.method !== "GET" && request.method !== "HEAD") {
      if (isFormData) {
        body = await request.arrayBuffer();
        // Preserve the original content-type with boundary for FormData
        headers["Content-Type"] = contentType;
      } else {
        try {
          body = await request.text();
        } catch {
          // No body
        }
      }
    }

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
    });

    const responseContentType = response.headers.get("Content-Type") || "application/json";

    // SSE streams: pipe through directly
    if (responseContentType.includes("text/event-stream") && response.body) {
      return new NextResponse(response.body as ReadableStream, {
        status: response.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Binary responses: pass through as ArrayBuffer
    if (
      responseContentType.includes("application/octet-stream") ||
      responseContentType.includes("application/pdf") ||
      responseContentType.includes("image/")
    ) {
      const data = await response.arrayBuffer();
      return new NextResponse(data, {
        status: response.status,
        headers: {
          "Content-Type": responseContentType,
          ...(response.headers.get("Content-Length")
            ? { "Content-Length": response.headers.get("Content-Length")! }
            : {}),
        },
      });
    }

    // Text responses: buffer and return
    const data = await response.text();
    return new NextResponse(data, {
      status: response.status,
      headers: { "Content-Type": responseContentType },
    });
  } catch (error) {
    console.error(`[API Proxy] ${request.method} /${path} failed:`, error);
    return NextResponse.json(
      { error: "Failed to proxy request to backend" },
      { status: 502 }
    );
  }
}
