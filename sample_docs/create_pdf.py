import sys
import pypdf

# Create a PDF file using pypdf
writer = pypdf.PdfWriter()
page = writer.add_blank_page(width=612, height=792)

# Or test pypdf writing/reading
with open("sample_docs/Sample_Research_Paper.pdf", "wb") as f:
    writer.write(f)

print("Created sample PDF.")
