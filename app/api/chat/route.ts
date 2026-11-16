import { NextResponse } from "next/server";
import { SessionsClient } from "@google-cloud/dialogflow-cx";

// Lazy-loaded client singleton to reuse across hot invocations
let sessionsClient: SessionsClient | null = null;

type SessionsClientOptions = ConstructorParameters<typeof SessionsClient>[0];

function getSessionsClient(): SessionsClient {
  if (sessionsClient) {
    return sessionsClient;
  }

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const location = process.env.DIALOGFLOW_LOCATION || "global";

  // Google private keys from .env frequently contain literal escaped '\n'
  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  // Dialogflow CX requires setting apiEndpoint for regional locations
  const apiEndpoint =
    location === "global"
      ? "dialogflow.googleapis.com"
      : `${location}-dialogflow.googleapis.com`;

  const clientConfig: SessionsClientOptions = {
    apiEndpoint,
  };

  if (clientEmail && privateKey) {
    clientConfig.credentials = {
      client_email: clientEmail,
      private_key: privateKey,
    };
  }

  sessionsClient = new SessionsClient(clientConfig);
  return sessionsClient;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, sessionId, languageCode = "en" } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "A valid 'message' text string is required." },
        { status: 400 }
      );
    }

    const projectId = process.env.DIALOGFLOW_PROJECT_ID;
    const location = process.env.DIALOGFLOW_LOCATION || "global";
    const agentId = process.env.DIALOGFLOW_AGENT_ID;

    // Validate required configuration variables
    if (!projectId || !agentId) {
      return NextResponse.json(
        {
          error:
            "Missing Dialogflow CX configuration. Set DIALOGFLOW_PROJECT_ID and DIALOGFLOW_AGENT_ID.",
        },
        { status: 500 }
      );
    }

    // Dynamic session ID: use client-supplied session ID or generate one
    const currentSessionId =
      sessionId && typeof sessionId === "string" && sessionId.trim()
        ? sessionId.trim()
        : crypto.randomUUID();

    const client = getSessionsClient();

    // Construct the Dialogflow CX session path
    const sessionPath = client.projectLocationAgentSessionPath(
      projectId,
      location,
      agentId,
      currentSessionId
    );

    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: message.trim(),
        },
        languageCode,
      },
    };

    const [response] = await client.detectIntent(request);

    // Extract all text responses from the agent's responseMessages
    const responseMessages = response.queryResult?.responseMessages || [];
    const textResponses: string[] = [];

    for (const msg of responseMessages) {
      if (msg.text?.text && Array.isArray(msg.text.text)) {
        for (const t of msg.text.text) {
          if (t && t.trim()) {
            textResponses.push(t.trim());
          }
        }
      }
    }

    const reply =
      textResponses.length > 0
        ? textResponses.join("\n\n")
        : "I received your message, but no text response was returned by the agent.";

    return NextResponse.json({
      reply,
      messages: textResponses,
      sessionId: currentSessionId,
      match: {
        intent: response.queryResult?.intent?.displayName || null,
        confidence: response.queryResult?.intentDetectionConfidence || null,
        matchType: response.queryResult?.match?.matchType || null,
      },
    });
  } catch (error: unknown) {
    console.error("Error in Dialogflow CX detectIntent API route:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";

    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
