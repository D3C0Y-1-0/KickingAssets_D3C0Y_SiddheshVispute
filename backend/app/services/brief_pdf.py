"""PDF rendering of the risk brief, built with reportlab.

The brief is already assembled by `brief.build_brief`; this module only lays it out. It uses the
built-in PDF fonts so it works offline, which means characters outside Latin-1 are replaced by
plain equivalents first.
"""

import io
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.schemas.insights import RiskBrief

INK = colors.HexColor("#14201A")
MUTED = colors.HexColor("#5B6B63")
ACCENT = colors.HexColor("#8BC400")
BAND = colors.HexColor("#0E1512")
NOTE_BG = colors.HexColor("#FFF6DC")
NOTE_LINE = colors.HexColor("#E0B84C")
FOOTER = "Fictional infrastructure. Relative risk index, not an incident probability."

_PLAIN = str.maketrans(
    {
        "→": "->",
        "←": "<-",
        "×": "x",
        "≥": ">=",
        "≤": "<=",
        "–": "-",
        "—": "-",
        "−": "-",
        "‘": "'",
        "’": "'",
        "“": '"',
        "”": '"',
        "…": "...",
        "≈": "~",
        "•": "-",
    }
)


def _text(value: object) -> str:
    """Escape for reportlab markup and keep only characters the built-in fonts can draw."""
    plain = str(value).translate(_PLAIN)
    return escape(plain.encode("cp1252", errors="replace").decode("cp1252"))


def _styles() -> dict[str, ParagraphStyle]:
    base = ParagraphStyle("base", fontName="Helvetica", fontSize=10, leading=14.5, textColor=INK)
    return {
        "title": ParagraphStyle(
            "title", parent=base, fontName="Helvetica-Bold", fontSize=24, leading=28, spaceAfter=4
        ),
        "meta": ParagraphStyle("meta", parent=base, fontSize=8.5, leading=12, textColor=MUTED),
        "note": ParagraphStyle(
            "note", parent=base, fontName="Helvetica-Bold", fontSize=9.5, leading=13.5
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=base,
            fontName="Helvetica-Bold",
            fontSize=13.5,
            leading=17,
            spaceBefore=16,
            spaceAfter=2,
            keepWithNext=True,
        ),
        "li": ParagraphStyle(
            "li", parent=base, leftIndent=14, bulletIndent=2, spaceBefore=3, spaceAfter=0
        ),
        "gap": ParagraphStyle(
            "gap", parent=base, textColor=MUTED, fontName="Helvetica-Oblique", leftIndent=14
        ),
    }


def _first_page(canvas, doc) -> None:
    width, height = A4
    canvas.saveState()
    canvas.setFillColor(BAND)
    canvas.rect(0, height - 26 * mm, width, 26 * mm, stroke=0, fill=1)
    canvas.setFillColor(ACCENT)
    canvas.rect(0, height - 26 * mm, 5 * mm, 26 * mm, stroke=0, fill=1)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 17)
    canvas.drawString(18 * mm, height - 14.5 * mm, "GRIDINAL")
    canvas.setFillColor(ACCENT)
    canvas.setFont("Helvetica", 9.5)
    canvas.drawString(
        18 * mm, height - 20.5 * mm, "Infrastructure risk brief  |  Aurora City simulation"
    )
    canvas.restoreState()
    _footer(canvas, doc)


def _footer(canvas, doc) -> None:
    width, _ = A4
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#D5DDD7"))
    canvas.line(18 * mm, 14 * mm, width - 18 * mm, 14 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(18 * mm, 9.5 * mm, FOOTER)
    canvas.drawRightString(width - 18 * mm, 9.5 * mm, f"Page {doc.page}")
    canvas.restoreState()


def to_pdf(brief: RiskBrief) -> bytes:
    s = _styles()
    out = io.BytesIO()
    doc = SimpleDocTemplate(
        out,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=20 * mm,
        title="Gridinal risk brief",
        author="Gridinal",
        subject=f"Run {brief.run_id}",
    )
    meta = (
        f"Scenario {_text(brief.scenario_id)}  |  snapshot {_text(brief.snapshot_id)}  |  "
        f"run {_text(brief.run_id)}<br/>As of {brief.as_of}  |  model {_text(brief.model_version)}  |  "
        f"scoring {_text(brief.scoring_version)}  |  generated "
        f"{brief.generated_at:%Y-%m-%d %H:%M} UTC"
    )
    note = Table(
        [[Paragraph(_text(FOOTER) + " Simulated and assumed inputs are labelled.", s["note"])]],
        colWidths=[doc.width],
    )
    note.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), NOTE_BG),
                ("BOX", (0, 0), (-1, -1), 0.8, NOTE_LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story: list = [
        Spacer(1, 16 * mm),
        Paragraph("Risk brief", s["title"]),
        Paragraph(meta, s["meta"]),
        Spacer(1, 8),
        note,
    ]
    for section in brief.sections:
        lines = (
            [Paragraph(_text(line), s["li"], bulletText="•") for line in section.lines]
            if section.available
            else [Paragraph("Not available for this run.", s["gap"])]
        )
        story.append(
            KeepTogether(
                [
                    Paragraph(_text(section.title), s["h2"]),
                    HRFlowable(width="100%", thickness=1.4, color=ACCENT, spaceAfter=3),
                    *lines[:2],
                ]
            )
        )
        story.extend(lines[2:])
    doc.build(story, onFirstPage=_first_page, onLaterPages=_footer)
    return out.getvalue()
