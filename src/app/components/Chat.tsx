"use client";

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { IoMdSend } from "react-icons/io";
import { db } from "../../../firebase";
import { useAppContext } from "@/context/AppContext";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { materialDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import OpenAI from "openai";
import LoadingIcons from "react-loading-icons";
import { ChatGPTAgent, ChatGPTMessage } from "@/utils/open-ai-streaming";

type Message = {
  content: ChatGPTAgent;
  role: string;
  createdAt: string;
};

const Chat = () => {
  const { selectedRoom, selectRoomName } = useAppContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [relatedWords, setRelatedWords] = useState<string[]>([]);

  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [isDone, setIsDone] = useState(false);

  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const element = textAreaRef.current;
    if (!element) {
      return;
    }
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight + 4}px`;
  };

  const sendToGPT = async (inputText?: string) => {
    setIsLoading(true);
    setRelatedWords([]);

    const messageData = {
      content: inputText || input,
      role: "user",
      createdAt: serverTimestamp(),
    };

    //  メッセージをFirestoreに保存
    const roomDocRef = doc(db, "rooms", selectedRoom!);
    const messageCollectionRef = collection(roomDocRef, "messages");
    await addDoc(messageCollectionRef, messageData);

    const sendMessages: ChatGPTMessage[] = messages
      .map((item) => {
        return { role: item.role as ChatGPTAgent, content: item.content };
      })
      .slice(messages.length - 5);

    sendMessages.push({
      role: "user",
      content: inputText || input,
    });

    const res = await fetch("/api/response", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sendMessages),
    });

    setInput("");

    if (!res.ok) {
      throw new Error(res.statusText);
    }

    const data = res.body;
    if (!data) return;

    const reader = data.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let answer = "";

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      const chunkValue = decoder.decode(value);
      setResponse((prev) => prev + chunkValue);
      answer = answer + chunkValue;
    }
    setIsDone(true);

    const openai = new OpenAI({
      apiKey: process.env.NEXT_PUBLIC_OPENAI_KEY,
      dangerouslyAllowBrowser: true,
    });

    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `あなたはテキストを整形するアシスタントです。
          与えられた文字列に対して、JSON形式でパースしてください。
          JSONのキーはquestionとしてください。
          
          questionのバリューは配列で、配列内には20文字以内の質問文が3つ入ります。`,
        },
        {
          role: "user",
          content: answer,
        },
      ],
      model: "gpt-3.5-turbo-1106",
      // @ts-ignore
      response_format: {
        type: "json_object",
      },
    });
    const searchWords = completion.choices[0].message.content;
    if (searchWords && "question" in JSON.parse(searchWords)) {
      const questionArray = JSON.parse(searchWords).question;
      setRelatedWords([...questionArray]);
    }
  };

  const buttonSubmit = (event: React.MouseEvent<HTMLButtonElement>) => {
    const buttonText = event.currentTarget.textContent;
    if (!buttonText) {
      return;
    }
    sendToGPT(buttonText);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await sendToGPT();
  };

  const sendGptMessage = useCallback(async () => {
    const roomDocRef = doc(db, "rooms", selectedRoom!);
    const messageCollectionRef = collection(roomDocRef, "messages");

    await addDoc(messageCollectionRef, {
      content: response,
      role: "assistant",
      createdAt: serverTimestamp(),
    });

    setIsDone(false);
    setResponse("");
    setIsLoading(false);
  }, [response, selectedRoom]);

  useEffect(() => {
    if (!isDone) {
      return;
    }
    sendGptMessage();
  }, [isDone, sendGptMessage]);

  const scrollDiv = useRef<HTMLDivElement>(null);

  // 各ルームにおけるメッセージを取得
  useEffect(() => {
    if (selectedRoom) {
      const fetchMessages = async () => {
        const roomDocRef = doc(db, "rooms", selectedRoom);
        const messagesCollectionRef = collection(roomDocRef, "messages");

        const q = query(messagesCollectionRef, orderBy("createdAt"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const newMessages = snapshot.docs.map((doc) => doc.data() as Message);
          setMessages(newMessages);
        });

        return () => {
          unsubscribe();
        };
      };
      fetchMessages();
    }
  }, [selectedRoom]);

  useEffect(() => {
    if (scrollDiv.current) {
      const element = scrollDiv.current;
      element.scrollTo({
        top: element.scrollHeight,
      });
    }
  }, [response, messages, relatedWords.length]);

  return (
    <div className="bg-gray-800 h-full p-4 flex flex-col">
      <h1 className="text-md text-white mb-4  text-center">{selectRoomName}</h1>
      <div className="flex-grow overflow-y-auto mb-4 " ref={scrollDiv}>
        {messages.map(
          (message, index) =>
            message.content !== response && (
              <div key={index} className={message.role === "user" ? "text-right" : "text-left"}>
                <div
                  className={
                    message.role === "user"
                      ? "bg-gray-900 inline-block rounded px-4 py-4 mb-2"
                      : "bg-gray-700 inline-block rounded px-4 py-4 mb-2"
                  }
                >
                  <div className="text-white font-medium markdown">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        code: ({ node, className, style, children, ref, ...props }) => {
                          const match = /language-(\w+)/.exec(className || "");
                          return match ? (
                            <div className="my-4 rounded">
                              <div
                                className="flex items-center relative text-gray-200 bg-gray-800 gizmo:dark:bg-token-surface-primary px-4 py-2 text-xs font-sans justify-between rounded-t-md"
                                style={{ marginBottom: 0 }}
                              >
                                <span>{match[1]}</span>
                              </div>
                              <SyntaxHighlighter
                                style={materialDark}
                                language={match[1]}
                                PreTag="div"
                                customStyle={{ marginTop: 0, backgroundColor: "rgb(17, 24, 39)" }}
                                {...props}
                              >
                                {String(children).replace(/\n$/, "")}
                              </SyntaxHighlighter>
                            </div>
                          ) : (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          );
                        },
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            )
        )}
        {(response || isLoading) && (
          <div key={messages.length} className="text-left">
            <div className="bg-gray-700 inline-block rounded px-4 py-2 mb-2">
              <div className="text-white font-medium markdown">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >{`${response}${!isDone ? "●" : ""}`}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
        {relatedWords.length !== 0 && (
          <div className="flex w-full overflow-x-auto">
            {relatedWords.map((item, index) => (
              <button
                key={index}
                className="bg-slate-700 text-white px-4 py-2 mr-2 border rounded-full flex-none"
                onClick={buttonSubmit}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-shrink-0 relative">
        <form onSubmit={handleSubmit} className="flex">
          <textarea
            value={input}
            placeholder={isLoading ? "回答中..." : "メッセージを送信"}
            onChange={handleInput}
            className={`${
              isLoading ? "" : "border-2"
            } rounded w-full pr-10 p-2 focus:outline-none resize-none max-h-[10rem] font-medium`}
            style={{ overflowY: "hidden" }}
            ref={textAreaRef}
            rows={1}
            disabled={isLoading}
          ></textarea>
          <button className="absolute inset-y-0 right-1" disabled={isLoading}>
            <div
              className={`flex items-center justify-center ${
                isLoading ? "" : "hover:bg-blue-100"
              } p-2 rounded`}
            >
              {isLoading ? (
                <LoadingIcons.TailSpin
                  stroke="rgb(250, 250, 250)"
                  style={{ width: 24, height: 24 }}
                />
              ) : (
                <IoMdSend className="text-blue-600" style={{ width: 24, height: 24 }} />
              )}
            </div>
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
