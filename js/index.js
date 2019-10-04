function moveDiv() {
	let $span = $("#random");
	$span.fadeOut(570, function() {
		let maxLeft = $(window).width() - 1.5 * $span.width();
		let maxTop = $(window).height() - 1.5 * $span.height();
		let leftPos = Math.floor(Math.random() * (maxLeft + 1))
		let topPos = Math.floor(Math.random() * (maxTop + 1))
		$span.css({ left: leftPos, top: topPos }).fadeIn(570);
	});
};

