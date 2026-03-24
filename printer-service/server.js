device.open(() => {
  printer
    .font('A')
    .align('CT')
    .style('B')
    .size(1, 1)
    .text("BANANA LEAF")

    .style('NORMAL')
    .size(0, 0)
    .text("Seawoods, Navi Mumbai")
    .text("-------------------------------")

    .align('LT')
    .text("Date: 31/03/24   Time: 13:22")
    .text("Order: #123")
    .text("-------------------------------")

    // ITEMS
    .tableCustom([
      { text: "Item", align: "LEFT", width: 0.5 },
      { text: "Qty", align: "CENTER", width: 0.2 },
      { text: "Amt", align: "RIGHT", width: 0.3 }
    ])

    .tableCustom([
      { text: "Masala Dosa", align: "LEFT", width: 0.5 },
      { text: "1", align: "CENTER", width: 0.2 },
      { text: "₹190", align: "RIGHT", width: 0.3 }
    ])

    .tableCustom([
      { text: "Idli", align: "LEFT", width: 0.5 },
      { text: "2", align: "CENTER", width: 0.2 },
      { text: "₹100", align: "RIGHT", width: 0.3 }
    ])

    .text("-------------------------------")

    .tableCustom([
      { text: "Subtotal", align: "LEFT", width: 0.7 },
      { text: "₹290", align: "RIGHT", width: 0.3 }
    ])

    .tableCustom([
      { text: "CGST 2.5%", align: "LEFT", width: 0.7 },
      { text: "₹7.25", align: "RIGHT", width: 0.3 }
    ])

    .tableCustom([
      { text: "SGST 2.5%", align: "LEFT", width: 0.7 },
      { text: "₹7.25", align: "RIGHT", width: 0.3 }
    ])

    .text("-------------------------------")

    .style('B')
    .size(1, 1)
    .tableCustom([
      { text: "TOTAL", align: "LEFT", width: 0.5 },
      { text: "₹304.5", align: "RIGHT", width: 0.5 }
    ])

    .feed(2)
    .cut()
    .close();
});