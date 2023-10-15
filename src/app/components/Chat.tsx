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

type Message = {
  text: string;
  sender: string;
  createdAt: string;
};

const Chat = () => {
  const { selectedRoom, selectRoomName } = useAppContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [isDone, setIsDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const messageData = {
      text: input,
      sender: "user",
      createdAt: serverTimestamp(),
    };

    //  メッセージをFirestoreに保存
    const roomDocRef = doc(db, "rooms", selectedRoom!);
    const messageCollectionRef = collection(roomDocRef, "messages");
    await addDoc(messageCollectionRef, messageData);

    const res = await fetch("/api/response", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: `次のテキストに対する回答をマークダウン形式で教えてください。回答という文字は表示しないでください。オウムがえしはしないで下さい。テキスト:"""${input}"""`,
      }),
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

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      const chunkValue = decoder.decode(value);
      setResponse((prev) => prev + chunkValue);
    }
    setIsDone(true);
  };

  const sendGptMessage = useCallback(async () => {
    const roomDocRef = doc(db, "rooms", selectedRoom!);
    const messageCollectionRef = collection(roomDocRef, "messages");

    await addDoc(messageCollectionRef, {
      text: response,
      sender: "bot",
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
  }, [response, messages]);
  //   if (!inputMessage.trim()) return;

  //   const messageData = {
  //     text: inputMessage,
  //     sender: "user",
  //     createdAt: serverTimestamp(),
  //   };

  //   //  メッセージをFirestoreに保存
  //   const roomDocRef = doc(db, "rooms", selectedRoom!);
  //   const messageCollectionRef = collection(roomDocRef, "messages");
  //   await addDoc(messageCollectionRef, messageData);

  //   setInputMessage("");
  //   setIsLoading(true);

  //   // OpenAIからの返信
  //   const gpt3Response = await openai.chat.completions.create({
  //     messages: [{ role: "user", content: inputMessage }],
  //     model: "gpt-3.5-turbo",
  //   });

  //   setIsLoading(false);

  //   const botResponse = gpt3Response.choices[0].message.content;
  //   await addDoc(messageCollectionRef, {
  //     text: botResponse,
  //     sender: "bot",
  //     createdAt: serverTimestamp(),
  //   });
  // };

  return (
    <div className="bg-gray-800 h-full p-4 flex flex-col">
      <h1 className="text-md text-white mb-4  text-center">{selectRoomName}</h1>
      <div className="flex-grow overflow-y-auto mb-4 " ref={scrollDiv}>
        {messages.map(
          (message, index) =>
            message.text !== response && (
              <div key={index} className={message.sender === "user" ? "text-right" : "text-left"}>
                <div
                  className={
                    message.sender === "user"
                      ? "bg-gray-900 inline-block rounded px-4 py-4 mb-2"
                      : "bg-gray-700 inline-block rounded px-4 py-4 mb-2"
                  }
                >
                  <div className="text-white font-medium markdown">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {message.text}
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
      </div>
      <div className="flex-shrink-0 relative">
        <form onSubmit={handleSubmit}>
          <textarea
            value={input}
            placeholder="Send a Message"
            onChange={(e) => setInput(e.target.value)}
            className="border-2 rounded w-full pr-10 focus:outline-none p-2 resize-none"
          ></textarea>
          <button className="absolute inset-y-0 right-4 flex items-center" disabled={isLoading}>
            {isLoading ? "Loading..." : <IoMdSend />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
