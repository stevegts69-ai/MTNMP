import React from "react";
import { TextInput, TextInputProps } from "react-native";

/**
 * Drop-in replacement for React Native's TextInput.
 *
 * Root cause fix: NativeWind's `className` does not reliably set the
 * native `placeholderTextColor` prop, and none of our screens set an
 * explicit text color either — both defaulted to something that renders
 * as invisible (light-on-light) in the standalone build, even though it
 * looked fine in Expo Go during development. This wrapper guarantees
 * both are always set, so no individual screen can accidentally omit them.
 */
export default function AppTextInput({
  className = "",
  placeholderTextColor = "#9CA3AF", // gray-400
  ...props
}: TextInputProps & { className?: string }) {
  return (
    <TextInput
      placeholderTextColor={placeholderTextColor}
      className={`text-gray-900 ${className}`}
      {...props}
    />
  );
}