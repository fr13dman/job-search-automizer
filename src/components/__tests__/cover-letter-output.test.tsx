import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CoverLetterOutput } from "@/components/cover-letter-output";

describe("CoverLetterOutput", () => {
  const onTextChange = vi.fn();

  it("displays streaming text while loading", () => {
    render(
      <CoverLetterOutput
        completion="Dear Hiring Manager,"
        isLoading={true}
        onTextChange={onTextChange}
      />
    );
    const textarea = screen.getByLabelText(/cover letter/i);
    expect(textarea).toHaveValue("Dear Hiring Manager,");
    expect(textarea).toHaveAttribute("readonly");
  });

  it("shows placeholder when no content and not loading", () => {
    render(
      <CoverLetterOutput
        completion=""
        isLoading={false}
        onTextChange={onTextChange}
      />
    );
    expect(
      screen.getByText(/your cover letter will appear here/i)
    ).toBeInTheDocument();
  });

  it("switches to editable mode when loading completes", () => {
    const { rerender } = render(
      <CoverLetterOutput
        completion="Full letter text"
        isLoading={true}
        onTextChange={onTextChange}
      />
    );

    rerender(
      <CoverLetterOutput
        completion="Full letter text"
        isLoading={false}
        onTextChange={onTextChange}
      />
    );

    const textarea = screen.getByLabelText(/cover letter/i);
    expect(textarea).not.toHaveAttribute("readonly");
  });

  it("allows user to modify text after generation", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <CoverLetterOutput
        completion="Original"
        isLoading={true}
        onTextChange={onTextChange}
      />
    );

    rerender(
      <CoverLetterOutput
        completion="Original"
        isLoading={false}
        onTextChange={onTextChange}
      />
    );

    const textarea = screen.getByLabelText(/cover letter/i);
    await user.clear(textarea);
    await user.type(textarea, "Edited");

    expect(onTextChange).toHaveBeenCalledWith("Edited");
  });
});
