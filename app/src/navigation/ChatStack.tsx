import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ChatColleaguePickerScreen from "../screens/Chat/ChatColleaguePickerScreen";
import ChatListScreen from "../screens/Chat/ChatListScreen";
import ChatThreadScreen from "../screens/Chat/ChatThreadScreen";
import type { ChatStackParamList } from "../lib/chat";

const Stack = createNativeStackNavigator<ChatStackParamList>();

export default function ChatStack() {
  return (
    <Stack.Navigator screenOptions={{ headerTitleStyle: { fontWeight: "600" } }}>
      <Stack.Screen name="ChatList" component={ChatListScreen} options={{ title: "Chat" }} />
      <Stack.Screen name="ChatThread" component={ChatThreadScreen} options={{ title: "Conversation" }} />
      <Stack.Screen
        name="ChatColleaguePicker"
        component={ChatColleaguePickerScreen}
        options={{ title: "Choose colleague" }}
      />
    </Stack.Navigator>
  );
}