/*
  Data layer entry point. One async interface; two implementations:
  the in-memory demo store (zero config) and Supabase (production).
*/

import { supabaseConfigured } from "@/lib/config";
import * as demo from "./demo";
import * as supabase from "./supabase";

const impl = supabaseConfigured ? supabase : demo;

export const getTracks = impl.getTracks;
export const getTrack = impl.getTrack;
export const createTrack = impl.createTrack;
export const deleteTrack = impl.deleteTrack;
export const getMatchesForTrack = impl.getMatchesForTrack;
export const countMatchesForTrack = impl.countMatchesForTrack;
export const getFeed = impl.getFeed;
export const countFeed = impl.countFeed;
export const expressInterest = impl.expressInterest;
export const passMatch = impl.passMatch;
export const getThreads = impl.getThreads;
export const getThread = impl.getThread;
export const countUnread = impl.countUnread;
export const sendMessage = impl.sendMessage;
export const markThreadRead = impl.markThreadRead;
export const setSubscription = impl.setSubscription;
export const cancelSubscription = impl.cancelSubscription;

export { inboxWritable } from "./shared";
