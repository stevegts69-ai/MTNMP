import React from "react";
import { Modal, View, Text, ScrollView, Pressable } from "react-native";
import { PRIVACY_POLICY, TERMS_OF_SERVICE } from "../legal/legalContent";
import { SafeAreaView } from "react-native-safe-area-context";

interface Props {
  visible: boolean;
  document: "privacy" | "terms";
  onClose: () => void;
}

export default function LegalModal({ visible, document, onClose }: Props) {
  const content = document === "privacy" ? PRIVACY_POLICY : TERMS_OF_SERVICE;
  const title = document === "privacy" ? "Privacy Policy" : "Terms of Service";

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-clinical-bg">
        <View className="flex-row justify-between items-center px-5 py-4 border-b border-gray-200">
          <Text className="text-lg font-semibold text-clinical-primary">{title}</Text>
          <Pressable onPress={onClose}>
            <Text className="text-clinical-primary font-medium">Close</Text>
          </Pressable>
        </View>
        <ScrollView className="flex-1 px-5 py-4">
          <Text className="text-sm text-gray-700 leading-6">{content}</Text>
          <View className="h-10" />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}