"use client";

import {
  Timestamp,
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { BiLogOut } from "react-icons/bi";
import { auth, db } from "../../../firebase";
import { useAppContext } from "@/context/AppContext";

type Room = {
  id: string;
  name: string;
  createdAt: Timestamp;
};

const Sidebar = () => {
  const { user, userId, setSelectedRoom, setSelectRoomName } = useAppContext();
  const [rooms, setRooms] = useState<Room[]>();

  const selectRoom = (roomId: string, roomName: string) => {
    setSelectedRoom(roomId);
    setSelectRoomName(roomName);
  };

  useEffect(() => {
    if (user) {
      const fetchRooms = async () => {
        const roomCollectionRef = collection(db, "rooms");
        const q = query(
          roomCollectionRef,
          where("userId", "==", userId),
          orderBy("createdAt", "desc")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const newRooms: Room[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name,
            createdAt: doc.data().createdAt,
          }));
          setRooms(newRooms);
          setSelectedRoom(newRooms[0].id);
          setSelectRoomName(newRooms[0].name);
        });

        return () => {
          unsubscribe();
        };
      };
      fetchRooms();
    }
  }, [user, userId, setSelectedRoom, setSelectRoomName]);

  const addNewRoom = async () => {
    const roomName = prompt("ルーム名を入力してください。");
    if (roomName && userId) {
      const newRoomRef = collection(db, "rooms");
      await addDoc(newRoomRef, {
        name: roomName,
        userId: userId,
        createdAt: serverTimestamp(),
      });
    }
  };

  const handleLogout = () => {
    auth.signOut();
  };

  return (
    <div className="bg-gray-900 h-full overflow-y-auto flex flex-col">
      <div className="flex-grow px-4">
        <div
          onClick={addNewRoom}
          className="flex justify-center items-center border mt-4 mb-4 p-2 rounded-md hover:bg-slate-700 duration-150 cursor-pointer"
        >
          <span className="text-white text-md">+</span>
          <h1 className="text-white text-md ml-4">New Chat</h1>
        </div>
        <ul>
          {rooms?.map((room) => (
            <li
              key={room.id}
              className="cursor-pointer p-4 text-slate-100 hover:bg-slate-700 duration-150 rounded-md"
              onClick={() => selectRoom(room.id, room.name)}
            >
              {room.name}
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t border-gray-700">
        <div className="p-6">
          {user && <div className="mb-4  text-slate-100 text-sm font-medium">{user.email}</div>}
          <button
            onClick={handleLogout}
            className="text-md flex w-full py-2 items-center mb-4 cursor-pointer rounded-md text-slate-100 hover:bg-slate-700 duration-150"
          >
            <BiLogOut />
            <span className="ml-2">ログアウト</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
