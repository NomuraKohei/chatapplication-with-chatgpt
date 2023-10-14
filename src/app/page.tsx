"use client";
export const runtime = "edge";

import Sidebar from "./components/Sidebar";
import Chat from "./components/Chat";
import { useAppContext } from "@/context/AppContext";

export default function Home() {
  const { user } = useAppContext();

  return (
    <div className="flex h-screen justify-center items-center">
      <div className="h-full flex w-full">
        <div className="w-1/5 h-full">
          <Sidebar />
        </div>
        <div className="w-4/5 h-full">
          <Chat />
        </div>
      </div>
    </div>
  );
}
