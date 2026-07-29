import React, { useState } from "react";
import { View, Text, Pressable, useWindowDimensions } from "react-native";

interface Slide {
  title: string;
  body: string;
  accent: string; // hex color for the top accent bar, varies per slide for visual rhythm
}

const SLIDES: Slide[] = [
  {
    title: "Metabolic Nuclear Medicine Platform",
    body: "A clinical record-keeping and monitoring companion for physicians using metabolic monitoring alongside established, targeted radionuclide therapy.",
    accent: "#1E3A5F",
  },
  {
    title: "Grounded in established science",
    body: "Built on well-documented cancer metabolism research and validated targeted nuclear medicine — not experimental or unproven methods. Metabolic tracking is designed to work alongside your broader clinical approach, not replace it.",
    accent: "#2E7D6B",
  },
  {
    title: "A clinical support tool, not a diagnostic device",
    body: "This app does not diagnose, calculate doses, or recommend treatment. Every clinical decision remains yours, based on your own training, judgment, and institutional process. The app records and organizes — it doesn't decide.",
    accent: "#C9A227",
  },
  {
    title: "Built with data protection in mind",
    body: "Encrypted storage and transit, row-level institutional access control, biometric device lock, and full audit logging — designed in alignment with HIPAA and GDPR data-handling principles.",
    accent: "#1E3A5F",
  },
];

interface Props {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  const [index, setIndex] = useState(0);
  const { width } = useWindowDimensions();
  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  return (
    <View className="flex-1 bg-clinical-bg">
      <View style={{ height: 6, backgroundColor: slide.accent }} />

      <View className="flex-1 justify-center px-8">
        <Text className="text-2xl font-semibold text-clinical-primary mb-4 text-center">
          {slide.title}
        </Text>
        <Text className="text-base text-gray-600 text-center leading-6">
          {slide.body}
        </Text>
      </View>

      {/* Progress dots */}
      <View className="flex-row justify-center mb-8">
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === index ? 20 : 8,
              height: 8,
              borderRadius: 4,
              marginHorizontal: 4,
              backgroundColor: i === index ? "#1E3A5F" : "#D1D5DB",
            }}
          />
        ))}
      </View>

      <View className="px-8 pb-10 flex-row justify-between items-center">
        {index > 0 ? (
          <Pressable onPress={() => setIndex((i) => i - 1)} className="py-3 px-2">
            <Text className="text-gray-500">Back</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onComplete} className="py-3 px-2">
            <Text className="text-gray-400">Skip</Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => (isLast ? onComplete() : setIndex((i) => i + 1))}
          className="bg-clinical-primary rounded-lg px-6 py-3"
        >
          <Text className="text-white font-medium">{isLast ? "Get Started" : "Next"}</Text>
        </Pressable>
      </View>
    </View>
  );
}