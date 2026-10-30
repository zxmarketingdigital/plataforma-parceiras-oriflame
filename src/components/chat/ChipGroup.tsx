"use client";

import { useEffect, useRef, useState } from "react";
import type { ApiOption } from "./types";
import styles from "./DiagnosticChat.module.css";

interface ChipGroupProps {
  questionKey: string;
  labelledBy: string;
  options: ApiOption[];
  disabled?: boolean;
  onSelect: (option: ApiOption) => void;
}

export function ChipGroup({ questionKey, labelledBy, options, disabled = false, onSelect }: ChipGroupProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setActiveIndex(0);
    const firstButton = buttons.current[0];
    if (!disabled && firstButton) firstButton.focus();
  }, [disabled, questionKey]);

  const moveFocus = (nextIndex: number) => {
    const normalized = (nextIndex + options.length) % options.length;
    setActiveIndex(normalized);
    buttons.current[normalized]?.focus();
  };

  return (
    <div className={styles.chips} role="group" aria-labelledby={labelledBy}>
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(element) => {
            buttons.current[index] = element;
          }}
          className={styles.chip}
          type="button"
          tabIndex={activeIndex === index ? 0 : -1}
          disabled={disabled}
          aria-label={option.label}
          onClick={() => onSelect(option)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowDown") {
              event.preventDefault();
              moveFocus(index + 1);
            }
            if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
              event.preventDefault();
              moveFocus(index - 1);
            }
            if (event.key === "Home") {
              event.preventDefault();
              moveFocus(0);
            }
            if (event.key === "End") {
              event.preventDefault();
              moveFocus(options.length - 1);
            }
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
