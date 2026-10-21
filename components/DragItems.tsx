"use client";

import type { ReactNode } from "react";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";

export type DragInfo =
  | { kind: "game"; gameId: string; categoryId: string }
  | { kind: "category"; categoryId: string };
export type TargetInfo =
  | DragInfo
  | { kind: "category-target"; categoryId: string }
  | { kind: "shelf-target"; shelfId: string }
  | { kind: "library-target" }
  | { kind: "dashboard-target" };

export function SortableItem({ id, data, children, className = "" }: {
  id: string; data: DragInfo; children: ReactNode; className?: string;
}) {
  const { attributes,listeners,setNodeRef,transform,transition,isDragging }=useSortable({id,data});
  return <div ref={setNodeRef} {...attributes} {...listeners}
    className={"drag-item "+className+(isDragging?" is-dragging":"")}
    style={{transform:CSS.Transform.toString(transform),transition,touchAction:"pan-y"}}>
    {children}
  </div>;
}
export function DragItem({ id,data,children,className="" }: {
  id:string;data:DragInfo;children:ReactNode;className?:string;
}) {
  const {attributes,listeners,setNodeRef,transform,isDragging}=useDraggable({id,data});
  return <div ref={setNodeRef} {...attributes} {...listeners}
    className={"drag-item "+className+(isDragging?" is-dragging":"")}
    style={{transform:CSS.Translate.toString(transform),touchAction:"pan-y"}}>
    {children}
  </div>;
}
export function DropTarget({ id,data,children,className="" }: {
  id:string;data:TargetInfo;children:ReactNode;className?:string;
}) {
  const {setNodeRef,isOver}=useDroppable({id,data});
  return <div ref={setNodeRef} className={"drop-target "+className+(isOver?" drop-target-active":"")}>
    {children}
  </div>;
}
