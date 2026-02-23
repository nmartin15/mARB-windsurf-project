import pytest

from edi_utils import detect_delimiters, parse_edi_content, split_composite


@pytest.mark.unit
def test_detect_delimiters_defaults_when_no_isa():
    result = detect_delimiters("GS*HP*AA*BB*20260222*1200*1*X*005010X221A1~")
    assert result == {"segment": "~", "element": "*", "component": ":", "repetition": "^"}


@pytest.mark.unit
def test_parse_edi_content_uses_detected_separators():
    element = "|"
    component = ":"
    segment = "~"
    isa = (
        f"ISA{element}00{element}{'':<10}{element}00{element}{'':<10}{element}"
        f"ZZ{element}{'SENDERID':<15}{element}ZZ{element}{'RECEIVERID':<15}{element}"
        f"260221{element}1230{element}^{element}00501{element}000000001{element}0{element}P{element}"
        f"{component}{segment}"
    )
    content = isa + "GS|HP|A|B|20260221|1230|1|X|005010X221A1~ST|837|0001~SE|2|0001~"

    segments, delimiters = parse_edi_content(content)

    assert delimiters["element"] == "|"
    assert segments[1][0] == "GS"
    assert segments[2][0] == "ST"


@pytest.mark.unit
def test_split_composite_supports_primary_and_fallback_separators():
    assert split_composite("HC:99213:25", ":") == ["HC", "99213", "25"]
    assert split_composite("HC>99213>25", ":") == ["HC", "99213", "25"]
    assert split_composite("HC*99213*25", "*") == ["HC", "99213", "25"]
    assert split_composite("SINGLE", ":") == ["SINGLE"]
