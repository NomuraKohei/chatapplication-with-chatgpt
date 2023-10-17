export const runtime = 'edge';

import { ChatGPTMessage, OpenAIStream, OpenAIStreamPayload } from "../../../utils/open-ai-streaming";

if (!process.env.NEXT_PUBLIC_OPENAI_KEY) {
  throw new Error("Missing OpenAI API KEY")
}

export const POST = async (req: Request) => {
  const sendMessages = (await req.json()) as ChatGPTMessage[];

  if (!sendMessages) return new Response("Missing prompt", { status: 400 });

  const payload: OpenAIStreamPayload = {
    model: "gpt-3.5-turbo",
    messages: sendMessages,
    temperature: 0.7,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    max_tokens: 600,
    stream: true,
    n: 1,
  };

  const stream = await OpenAIStream(payload);

  return new Response(stream);
};
