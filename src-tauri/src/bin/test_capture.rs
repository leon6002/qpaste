use xcap::Monitor;

fn main() {
    let monitors = Monitor::all().unwrap();
    for monitor in monitors {
        let x = monitor.x();
        let y = monitor.y();
        let width = monitor.width();
        let height = monitor.height();
        let scale_factor = monitor.scale_factor();

        println!(
            "Monitor: x={}, y={}, width={}, height={}, scale={}",
            x, y, width, height, scale_factor
        );

        let image = monitor.capture_image().unwrap();
        println!("Captured Image: {}x{}", image.width(), image.height());
    }
}
