"""PDF rendering of the risk brief, built with reportlab.

The brief is already assembled by `brief.build_brief`; this module only lays it out. It uses the
built-in PDF fonts so it works offline, which means characters outside Latin-1 are replaced by
plain equivalents first.
"""

import io
from xml.sax.saxutils import escape

from reportlab.graphics.shapes import Drawing, Rect, String
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
from app.schemas.simulation import SimulationRun

INK = colors.HexColor("#14201A")
MUTED = colors.HexColor("#5B6B63")
ACCENT = colors.HexColor("#8BC400")
BAND = colors.HexColor("#0E1512")
NOTE_BG = colors.HexColor("#FFF6DC")
NOTE_LINE = colors.HexColor("#E0B84C")
BAND_COLORS = {
    "critical": colors.HexColor("#D93C3C"),
    "high": colors.HexColor("#E8893A"),
    "medium": colors.HexColor("#D9B53A"),
    "low": colors.HexColor("#7FB800"),
}
TOP_TABLE = 10
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


def _kpis(run: SimulationRun, width: float, s: dict[str, ParagraphStyle]) -> Table:
    city = run.city_risk
    counts = {c.category: c.count for c in run.category_counts}
    worst = max((x.worst_disruption_fraction for x in run.services), default=None)
    tiles = [
        (
            f"{city.score:.1f}" if city.score is not None else "n/a",
            f"City risk index ({city.category})",
        ),
        (str(counts.get("critical", 0)), "Critical assets"),
        (f"{round(worst * 100)}%" if worst is not None else "n/a", "Worst service disruption"),
        (str(len(run.assets)), "Assets assessed"),
    ]
    big = ParagraphStyle("kpi", parent=s["title"], fontSize=22, leading=26, spaceAfter=0)
    cells = [[Paragraph(_text(v), big), Paragraph(_text(k), s["meta"])] for v, k in tiles]
    table = Table([[c[0] for c in cells], [c[1] for c in cells]], colWidths=[width / 4] * 4)
    table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#D5DDD7")),
                ("LINEAFTER", (0, 0), (-2, -1), 0.6, colors.HexColor("#D5DDD7")),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F5F8F2")),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, 0), 9),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 9),
            ]
        )
    )
    return table


def _band_chart(run: SimulationRun, width: float) -> Drawing:
    counts = {c.category: c.count for c in run.category_counts}
    total = max(sum(counts.values()), 1)
    height = 22
    d = Drawing(width, height)
    x = 0.0
    for band in ("critical", "high", "medium", "low"):
        n = counts.get(band, 0)
        if not n:
            continue
        w = width * n / total
        d.add(
            Rect(
                x,
                0,
                w,
                height,
                fillColor=BAND_COLORS[band],
                strokeColor=colors.white,
                strokeWidth=1,
            )
        )
        d.add(
            String(
                x + 7,
                7,
                f"{n} {band}" if w >= 55 else str(n),
                fontName="Helvetica-Bold",
                fontSize=9,
                fillColor=colors.white,
            )
        )
        x += w
    return d


def _top_table(run: SimulationRun, width: float, s: dict[str, ParagraphStyle]) -> Table:
    scored = sorted(
        (a for a in run.assets if a.risk.score is not None),
        key=lambda a: (-(a.risk.score or 0), a.asset_id),
    )[:TOP_TABLE]
    cell = ParagraphStyle(
        "cell", parent=s["li"], leftIndent=0, bulletIndent=0, spaceBefore=0, fontSize=9
    )
    rows = [["#", "Asset", "Sector", "Score", "Band"]]
    for i, a in enumerate(scored, 1):
        rows.append(
            [
                str(i),
                Paragraph(f"<b>{_text(a.asset_id)}</b>  {_text(a.name)}", cell),
                _text(a.sector).title(),
                f"{a.risk.score:.1f}",
                str(a.risk.category).title(),
            ]
        )
    table = Table(rows, colWidths=[8 * mm, width - 8 * mm - 62 * mm, 22 * mm, 16 * mm, 24 * mm])
    style = [
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BACKGROUND", (0, 0), (-1, 0), BAND),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F8F2")]),
        ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#D5DDD7")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (3, 0), (3, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for i, a in enumerate(scored, 1):
        style += [
            ("TEXTCOLOR", (4, i), (4, i), BAND_COLORS.get(str(a.risk.category), INK)),
            ("FONTNAME", (4, i), (4, i), "Helvetica-Bold"),
        ]
    table.setStyle(TableStyle(style))
    return table


def to_pdf(brief: RiskBrief, run: SimulationRun | None = None) -> bytes:
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
    if run is not None:
        story += [
            Spacer(1, 12),
            _kpis(run, doc.width, s),
            Spacer(1, 10),
            _band_chart(run, doc.width),
            Paragraph("Top assets by risk", s["h2"]),
            HRFlowable(width="100%", thickness=1.4, color=ACCENT, spaceAfter=6),
            _top_table(run, doc.width, s),
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
